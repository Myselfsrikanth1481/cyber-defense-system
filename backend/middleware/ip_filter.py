from fastapi import Request, HTTPException
import redis
import re
import json
from app.config import settings

try:
    r = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
    r.ping()
except Exception:
    r = None

MALICIOUS_UA_PATTERNS = [
    r"(?i)(nmap)",
    r"(?i)(nikto)",
    r"(?i)(sqlmap)",
    r"(?i)(masscan)",
    r"(?i)(zgrab)",
    r"(?i)(dirbuster)",
    r"(?i)(burpsuite)",
    r"(?i)(metasploit)",
    r"(?i)(python-requests/2\.[01])",
    r"(?i)(go-http-client/1\.1)",
    r"(?i)(curl/7\.[0-4])",
]

SCAN_PATH_PATTERNS = [
    r"(?i)(/wp-admin)",
    r"(?i)(/phpmyadmin)",
    r"(?i)(/.env)",
    r"(?i)(/shell)",
    r"(?i)(/backdoor)",
    r"(?i)(/eval)",
    r"(?i)(/cmd)",
]

async def ip_filter(request: Request) -> str:
    ip = (
        request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        or request.client.host
    )

    try:
        # ── Check if already blocked ──
        if r and r.get(f"blocked:{ip}"):
            raise HTTPException(status_code=403, detail="IP Blocked")

        # ── Fingerprint the request ──
        try:
            from services.fingerprinter import build_attacker_fingerprint
            fp = build_attacker_fingerprint(request, ip)

            # Cache fingerprint for use in main.py middleware
            if r:
                r.setex(
                    f"fp:{ip}",
                    60,
                    json.dumps({
                        "attacker_id":      fp["attacker_id"],
                        "ja3_hash":         fp["ja3_hash"],
                        "http2_hash":       fp["http2_hash"],
                        "client_guess":     fp["client_guess"],
                        "bot_score":        fp["bot_score"],
                        "behavior_pattern": fp["behavior_pattern"],
                        "tool_guess":       fp["tool_guess"],
                        "attack_patterns":  fp["attack_patterns"],
                        "payload_dna":      fp["payload_dna"],
                        "sophistication":   fp["sophistication"],
                        "threat_score":     fp["threat_score"],
                        "threat_level":     fp["threat_level"],
                        "fingerprint_conf": fp["fingerprint_conf"],
                    })
                )

            # Auto-block highly sophisticated attacks
            if fp["threat_score"] >= 80 and fp["fingerprint_conf"] >= 50:
                print(
                    f"🚨 HIGH THREAT fingerprint detected: "
                    f"{fp['attacker_id']} | Score:{fp['threat_score']} "
                    f"| Tool:{fp['tool_guess']} | IP:{ip}"
                )
                if r:
                    r.setex(f"blocked:{ip}", 3600, "fingerprint_threat")

        except Exception as fp_err:
            print(f"Fingerprint error (non-fatal): {fp_err}")

        # ── Check user agent for known scanners ──
        user_agent = request.headers.get("user-agent", "")
        for pattern in MALICIOUS_UA_PATTERNS:
            if re.search(pattern, user_agent):
                print(f"🚨 Malicious UA: {ip} | {user_agent}")
                if r:
                    r.setex(f"blocked:{ip}", 3600, "malicious_ua")
                raise HTTPException(
                    status_code=403,
                    detail="Port Scan detected — IP blocked"
                )

        # ── Check for scan-like path probing ──
        path = request.url.path
        for pattern in SCAN_PATH_PATTERNS:
            if re.search(pattern, path):
                if r:
                    scan_key = f"scan:{ip}"
                    count = r.incr(scan_key)
                    if count == 1:
                        r.expire(scan_key, 60)
                    if count > 5:
                        r.setex(f"blocked:{ip}", 3600, "port_scan")
                        raise HTTPException(
                            status_code=403,
                            detail="Port Scan detected — IP blocked"
                        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"IP filter error: {e}")

    return ip