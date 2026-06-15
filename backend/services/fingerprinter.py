import hashlib
import re
import time
from collections import defaultdict

# ── In-memory behavioral tracking (per IP) ────────────────────────────────────
_request_times: dict = defaultdict(list)
_endpoint_sequences: dict = defaultdict(list)

# ── Fingerprint 1: JA3-style TLS/HTTP Fingerprint ─────────────────────────────

def get_ja3_fingerprint(request) -> str:
    """
    Simulates JA3 fingerprinting using HTTP headers that reflect
    the underlying TLS/HTTP client stack. Real JA3 requires nginx
    TLS access — this is the application-layer equivalent.
    """
    ua = request.headers.get("user-agent", "")
    accept = request.headers.get("accept", "")
    accept_enc = request.headers.get("accept-encoding", "")
    accept_lang = request.headers.get("accept-language", "")
    sec_fetch = request.headers.get("sec-fetch-mode", "")
    connection = request.headers.get("connection", "")

    raw = f"{ua}|{accept}|{accept_enc}|{accept_lang}|{sec_fetch}|{connection}"
    return hashlib.md5(raw.encode()).hexdigest()


# ── Fingerprint 2: HTTP/2 Header Order Fingerprint ────────────────────────────

def get_http2_fingerprint(request) -> str:
    """
    Header order is determined by the HTTP client library being used.
    Chrome, Firefox, curl, Python requests, and attack tools all send
    headers in different orders — this is their HTTP/2 fingerprint.
    """
    header_keys = list(request.headers.keys())

    # Detect client type from header order patterns
    client_guess = "unknown"
    ua = request.headers.get("user-agent", "").lower()

    if "python" in ua or "python-requests" in ua:
        client_guess = "python-requests"
    elif "curl" in ua:
        client_guess = "curl"
    elif "go-http" in ua:
        client_guess = "go-http-client"
    elif "java" in ua:
        client_guess = "java-http"
    elif "mozilla" in ua and "chrome" in ua:
        client_guess = "chrome-browser"
    elif "mozilla" in ua and "firefox" in ua:
        client_guess = "firefox-browser"
    elif not ua:
        client_guess = "no-user-agent"  # highly suspicious

    # Hash the first 8 header names — order matters
    order_string = "|".join(header_keys[:8])
    fp_hash = hashlib.sha256(
        f"{order_string}:{client_guess}".encode()
    ).hexdigest()[:16]

    return fp_hash, client_guess


# ── Fingerprint 3: Behavioral Biometrics ──────────────────────────────────────

def get_behavioral_fingerprint(ip: str, endpoint: str) -> dict:
    """
    Analyzes request timing patterns to distinguish bots from humans.
    Bots have very low standard deviation in request intervals.
    Humans are irregular. Even 'jittered' bots are detectable.
    """
    now = time.time()
    times = _request_times[ip]
    times.append(now)

    # Track endpoint sequence
    seq = _endpoint_sequences[ip]
    seq.append(endpoint)

    # Keep last 30 requests only
    if len(times) > 30:
        times.pop(0)
    if len(seq) > 30:
        seq.pop(0)

    if len(times) < 3:
        return {
            "bot_score": 0,
            "pattern": "insufficient_data",
            "avg_interval": 0,
            "std_deviation": 0,
            "request_count": len(times),
            "requests_per_minute": 0,
        }

    # Calculate timing intervals
    intervals = [times[i+1] - times[i] for i in range(len(times)-1)]
    avg = sum(intervals) / len(intervals)
    variance = sum((x - avg) ** 2 for x in intervals) / len(intervals)
    std_dev = variance ** 0.5

    # Requests per minute
    time_window = times[-1] - times[0]
    rpm = (len(times) / time_window * 60) if time_window > 0 else 0

    # Bot scoring logic
    bot_score = 0
    pattern = "human"

    if std_dev < 0.02 and avg < 0.3:
        bot_score = 98
        pattern = "bot_precise"       # Perfect timing = automated tool
    elif std_dev < 0.05 and avg < 0.5:
        bot_score = 90
        pattern = "bot_fast"          # Very fast with low variance
    elif std_dev < 0.1 and avg < 1.0:
        bot_score = 75
        pattern = "bot_jittered"      # Trying to look human but failing
    elif rpm > 120:
        bot_score = 85
        pattern = "bot_high_rpm"      # 2+ requests/second sustained
    elif rpm > 60:
        bot_score = 60
        pattern = "suspicious_rpm"    # 1+ requests/second
    elif std_dev < 0.2 and avg < 2.0:
        bot_score = 40
        pattern = "suspicious"

    return {
        "bot_score": bot_score,
        "pattern": pattern,
        "avg_interval": round(avg, 3),
        "std_deviation": round(std_dev, 3),
        "request_count": len(times),
        "requests_per_minute": round(rpm, 1),
    }


# ── Fingerprint 4: Payload DNA ─────────────────────────────────────────────────

ATTACK_SIGNATURES = {
    # SQLMap signatures
    "sqlmap_basic":    r"AND \d+=\d+",
    "sqlmap_union":    r"UNION ALL SELECT NULL",
    "sqlmap_error":    r"extractvalue\(|updatexml\(",
    "sqlmap_blind":    r"SLEEP\(\d+\)|BENCHMARK\(\d+",
    "sqlmap_stacked":  r";\s*SELECT\s+",

    # Metasploit signatures
    "metasploit":      r"Meterpreter|msfvenom|msf>",

    # Burp Suite signatures
    "burp_xss":        r"<script>alert\(",
    "burp_sqli":       r"' OR '1'='1|\" OR \"1\"=\"1",

    # Nikto signatures
    "nikto":           r"Nikto|/cgi-bin/|/phpmyadmin",

    # Generic attack patterns
    "sqli_union":      r"(?i)union\s+select",
    "sqli_drop":       r"(?i)drop\s+table",
    "xss_basic":       r"(?i)<script[\s>]",
    "xss_event":       r"(?i)on\w+\s*=\s*[\"']",
    "path_traversal":  r"\.\./|\.\.\\/",
    "cmd_injection":   r"[;&|`]\s*(ls|cat|wget|curl|bash|sh|id|whoami)",
    "xxe_attack":      r"<!ENTITY|SYSTEM\s+\"file://",
    "ssrf_attempt":    r"(?i)(localhost|127\.0\.0\.1|169\.254\.169\.254)",
    "template_inject": r"\{\{.*\}\}|\$\{.*\}",
}

TOOL_PATTERNS = {
    "SQLMap":           ["sqlmap_basic", "sqlmap_union", "sqlmap_error", "sqlmap_blind"],
    "Metasploit":       ["metasploit"],
    "Burp Suite":       ["burp_xss", "burp_sqli"],
    "Nikto":            ["nikto"],
    "Custom Script":    ["sqli_union", "sqli_drop", "cmd_injection"],
    "XSS Tool":         ["xss_basic", "xss_event"],
}

def get_payload_dna(payload: str) -> dict:
    """
    Analyzes attack payload to identify patterns, tool signatures,
    and generate a DNA hash for cross-session attacker tracking.
    """
    if not payload or len(payload.strip()) == 0:
        return {
            "dna_hash": None,
            "detected_patterns": [],
            "tool_guess": "unknown",
            "attack_sophistication": 0,
        }

    detected = []
    for sig_name, pattern in ATTACK_SIGNATURES.items():
        if re.search(pattern, payload, re.IGNORECASE):
            detected.append(sig_name)

    # Guess the tool being used
    tool_guess = "unknown"
    best_match_count = 0
    for tool, sigs in TOOL_PATTERNS.items():
        matches = len([s for s in sigs if s in detected])
        if matches > best_match_count:
            best_match_count = matches
            tool_guess = tool

    if not detected:
        tool_guess = "unknown"
    elif len(detected) >= 5:
        tool_guess = "Automated Scanner"
    elif len(detected) == 1 and tool_guess == "unknown":
        tool_guess = "Manual Attack"

    # Sophistication score (0-100)
    sophistication = min(100, len(detected) * 15)
    if "sqlmap_blind" in detected or "sqlmap_error" in detected:
        sophistication = max(sophistication, 75)
    if "xxe_attack" in detected or "ssrf_attempt" in detected:
        sophistication = max(sophistication, 80)
    if "template_inject" in detected:
        sophistication = max(sophistication, 85)

    # DNA hash — same tool + same patterns = same hash across sessions
    dna_string = "|".join(sorted(detected))
    dna_hash = (
        "DNA-" + hashlib.sha256(dna_string.encode()).hexdigest()[:12].upper()
        if detected else None
    )

    return {
        "dna_hash": dna_hash,
        "detected_patterns": detected,
        "tool_guess": tool_guess,
        "attack_sophistication": sophistication,
    }


# ── Fingerprint 5: Composite Attacker ID ──────────────────────────────────────

def build_attacker_fingerprint(request, ip: str, payload: str = "") -> dict:
    """
    Combines all 4 fingerprints into one persistent Attacker ID.
    This ID stays the same even when the attacker:
      - Changes IP address
      - Uses a VPN
      - Switches between sessions
      - Uses the same tool from a different location
    """
    # Collect all components
    ja3 = get_ja3_fingerprint(request)
    http2_hash, client_guess = get_http2_fingerprint(request)
    behavioral = get_behavioral_fingerprint(ip, request.url.path)
    payload_dna = get_payload_dna(payload)

    # Build master fingerprint from stable components
    # We use JA3 + HTTP2 + payload DNA (not IP or timing which change)
    master_components = f"{ja3}:{http2_hash}"
    if payload_dna["dna_hash"]:
        master_components += f":{payload_dna['dna_hash']}"

    attacker_id = (
        "ATK-" +
        hashlib.sha256(master_components.encode()).hexdigest()[:16].upper()
    )

    # Confidence score — how reliable is this fingerprint (0-100)
    confidence = 0
    if ja3:             confidence += 30
    if http2_hash:      confidence += 25
    if behavioral["bot_score"] > 0: confidence += 20
    if payload_dna["dna_hash"]:     confidence += 25

    # Threat level
    threat_score = 0
    threat_score += min(40, behavioral["bot_score"] * 0.4)
    threat_score += min(30, payload_dna["attack_sophistication"] * 0.3)
    threat_score += 30 if payload_dna["detected_patterns"] else 0

    if threat_score >= 80:
        threat_level = "CRITICAL"
    elif threat_score >= 60:
        threat_level = "HIGH"
    elif threat_score >= 40:
        threat_level = "MEDIUM"
    elif threat_score >= 20:
        threat_level = "LOW"
    else:
        threat_level = "INFO"

    return {
        # Core identity
        "attacker_id":      attacker_id,
        # Fingerprint components
        "ja3_hash":         ja3,
        "http2_hash":       http2_hash,
        "client_guess":     client_guess,
        # Behavioral
        "bot_score":        behavioral["bot_score"],
        "behavior_pattern": behavioral["pattern"],
        "avg_interval":     behavioral["avg_interval"],
        "requests_per_min": behavioral["requests_per_minute"],
        # Payload
        "tool_guess":       payload_dna["tool_guess"],
        "attack_patterns":  payload_dna["detected_patterns"],
        "payload_dna":      payload_dna["dna_hash"],
        "sophistication":   payload_dna["attack_sophistication"],
        # Summary
        "threat_score":     round(threat_score),
        "threat_level":     threat_level,
        "fingerprint_conf": confidence,
    }
