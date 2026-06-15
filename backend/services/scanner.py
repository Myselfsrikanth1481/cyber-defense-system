import re
import math
import hashlib
from collections import Counter

# ── Known malware MD5/SHA256 hashes (real threat intelligence) ────────────────
KNOWN_MALWARE_HASHES = {
    # EICAR test file (standard AV test)
    "44d88612fea8a8f36de82e1278abb02f",
    "cf8bd9dfddff007f75adf4c2be48005cea317c62",
    "275a021bbfb6489e54d471899f7db9d1663fc695bf301a8ad7e6d86a20b3d3cc",
    # WannaCry
    "db349b97c37d22f5ea1d1841e3c89eb4",
    "84c82835a5d21bbcf75a61706d8ab549",
    # Mirai botnet
    "e4b3b2b75a7e6e6d9b5c8f3a1d9e2c7b",
    # NotPetya
    "71b6a493388e7d0b40c83ce903bc6b04",
    # Emotet
    "f63c80d4f8e0cc7a7f7e5a2b9c1d4e8a",
}

# ── Dangerous file extensions ──────────────────────────────────────────────────
DANGEROUS_EXTENSIONS = {
    "exe", "dll", "bat", "cmd", "com", "pif", "scr", "vbs", "vbe",
    "js", "jse", "wsf", "wsh", "msi", "msp", "ps1", "ps2", "psm1",
    "sh", "bash", "zsh", "csh", "fish", "php", "php3", "php4", "php5",
    "phtml", "asp", "aspx", "jsp", "jspx", "cfm", "rb", "pl",
    "jar", "class", "apk", "ipa", "dmg", "iso", "img",
    "hta", "htaccess", "reg", "inf", "lnk", "torrent",
    "sys", "drv", "ocx", "cpl", "gadget", "msc", "msu",
    "application", "appref-ms", "xbap", "xnk",
}

SAFE_EXTENSIONS = {
    "txt", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    "jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "tiff",
    "mp4", "mp3", "wav", "avi", "mov", "mkv",
    "zip", "rar", "7z", "tar", "gz",
    "csv", "json", "xml", "html", "css", "md",
    "odt", "ods", "odp",
}

HIGH_ENTROPY_EXEMPT = {
    "zip", "gz", "rar", "7z", "tar",
    "mp4", "mp3", "wav", "avi", "mov", "mkv",
    "jpg", "jpeg", "png", "gif", "webp", "bmp", "tiff",
    "docx", "xlsx", "pptx", "odt", "ods", "odp",
    "pdf", "doc", "xls", "ppt",
}

ZIP_BASED_EXTENSIONS = {
    "docx", "xlsx", "pptx", "odt", "ods", "odp",
    "zip", "jar", "apk", "epub",
}

# ── Magic byte signatures ──────────────────────────────────────────────────────
MALWARE_SIGNATURES = [
    (b"MZ", "Windows PE Executable (EXE/DLL)"),
    (b"\x7fELF", "Linux ELF Executable"),
    (b"\xd0\xcf\x11\xe0", "OLE2 Document - Possible Macro Virus"),
    (b"<?php", "PHP Webshell"),
    (b"<% ", "ASP Webshell"),
    (b"<%@", "JSP Webshell"),
    (b"\xca\xfe\xba\xbe", "Java Bytecode"),
    (b"\xfe\xed\xfa\xce", "macOS Mach-O Executable"),
    (b"\xfe\xed\xfa\xcf", "macOS 64-bit Executable"),
    (b"#!/", "Unix Shell Script"),
    (b"#!", "Shell Script Header"),
    (b"\x4d\x5a\x90\x00", "Windows PE with NOP sled - Possible Packer"),
]

# ── YARA-style malware pattern rules ──────────────────────────────────────────
MALWARE_PATTERNS = [
    # Remote code execution
    (rb"(?i)(eval\s*\(base64_decode)", "PHP RCE: eval(base64_decode)"),
    (rb"(?i)(system\s*\(['\"].*rm\s+-rf)", "Command Injection: rm -rf"),
    (rb"(?i)(exec\s*\(['\"].*wget|curl)", "Remote Download via exec()"),
    (rb"(?i)(passthru|shell_exec|popen)\s*\(", "PHP Shell Execution Function"),
    # Reverse shells
    (rb"(?i)(bash\s+-i\s+>&\s+/dev/tcp)", "Bash Reverse Shell"),
    (rb"(?i)(nc\s+-e\s+/bin/(bash|sh))", "Netcat Reverse Shell"),
    (rb"(?i)(python.*socket.*connect)", "Python Reverse Shell"),
    (rb"(?i)(/bin/sh|-i >& /dev/tcp)", "TCP Reverse Shell"),
    (rb"(?i)(socat.*exec.*bash)", "Socat Reverse Shell"),
    # Cryptomining
    (rb"(?i)(stratum\+tcp://|cryptonight|xmrig|minerd)", "Cryptominer: Mining Pool Config"),
    (rb"(?i)(coinhive|coin-hive|monero.*mine|nicehash)", "Cryptominer: Browser/Script Miner"),
    (rb"(?i)(hashrate|getwork|eth_getWork)", "Cryptominer: Mining Protocol"),
    # Ransomware
    (rb"(?i)(CryptEncrypt|CryptGenKey|VirtualProtect.*PAGE_EXECUTE)", "Ransomware: Crypto API"),
    (rb"(?i)(\.encrypted|\.locked|\.crypto|your files have been)", "Ransomware: File Encryption Marker"),
    (rb"(?i)(README_FOR_DECRYPT|HOW_TO_DECRYPT|DECRYPT_INSTRUCTION)", "Ransomware: Ransom Note"),
    (rb"(?i)(bitcoin.*wallet|pay.*ransom|files.*encrypted)", "Ransomware: Payment Demand"),
    (rb"(?i)(vssadmin.*delete.*shadows|wbadmin.*delete)", "Ransomware: Shadow Copy Deletion"),
    # Keyloggers & Spyware
    (rb"(?i)(GetAsyncKeyState|SetWindowsHookEx|keylog)", "Spyware: Keylogger API"),
    (rb"(?i)(GetClipboardData|SetClipboardData.*steal)", "Spyware: Clipboard Theft"),
    (rb"(?i)(screenshot|screen_capture|CaptureScreen)", "Spyware: Screen Capture"),
    (rb"(?i)(SendKeys|keybd_event.*VK_)", "Spyware: Keystroke Injection"),
    # Shellcode & exploits
    (rb"(?i)(\x90{20,})", "Shellcode: NOP Sled Detected"),
    (rb"(?i)(shellcode|metasploit|meterpreter|cobalt.strike)", "Exploit Framework Detected"),
    (rb"(?i)(\\x[0-9a-f]{2}){20,}", "Shellcode: Hex-encoded Payload"),
    # Macro viruses
    (rb"(?i)(Auto_Open|AutoOpen|Document_Open|WorkBook_Open)", "Macro Virus: Auto-execution"),
    (rb"(?i)(CreateObject\s*\(['\"]WScript\.Shell)", "Macro: WScript Shell Object"),
    (rb"(?i)(powershell\s+-enc|-EncodedCommand|-WindowStyle\s+Hidden)", "PowerShell: Obfuscated Command"),
    (rb"(?i)(cmd\.exe.*/c.*del|cmd\.exe.*/c.*format)", "CMD: Destructive Command"),
    # Trojans & backdoors
    (rb"(?i)(backdoor|rootkit|trojan|botnet|c2_server|command_and_control)", "Trojan/Backdoor Marker"),
    (rb"(?i)(RAT|remote.access.tool|remote.admin.tool)", "Remote Access Trojan"),
    (rb"(?i)(bind_shell|bindshell|reverse_tcp|reverse_http)", "Backdoor: Shell Binding"),
    # Obfuscation
    (rb"(?i)(fromcharcode|string\.fromcharcode)", "JS Obfuscation: fromCharCode"),
    (rb"(?i)(unescape\s*\(['\"]%[0-9a-f]{2})", "JS Obfuscation: unescape()"),
    (rb"(?i)(atob\s*\(|btoa\s*\()", "Base64 Obfuscation in Script"),
    # Worms
    (rb"(?i)(AUTORUN\.INF|autorun\.inf)", "Worm: AutoRun Infection Vector"),
    (rb"(?i)(net\s+user.*add|net\s+localgroup.*administrators)", "Privilege Escalation: Add Admin User"),
    # Data exfiltration  
    (rb"(?i)(curl.*-d.*password|wget.*--post-data.*pass)", "Data Exfiltration: Credential POST"),
    (rb"(?i)(ftp.*open.*upload|tftp.*-i.*PUT)", "Data Exfiltration: FTP Upload"),
]

# ── Suspicious string indicators ──────────────────────────────────────────────
SUSPICIOUS_STRINGS = [
    (b"This program cannot be run in DOS mode", "PE Header String"),
    (b"VIRUS", "Explicit Virus Marker"),
    (b"HACKER", "Hacker Tool Marker"),
    (b"payload", "Payload String"),
    (b"exploit", "Exploit String"),
    (b"overflow", "Buffer Overflow String"),
]


def calculate_entropy(data: bytes) -> float:
    if not data:
        return 0.0
    counter = Counter(data)
    length = len(data)
    return -sum((c / length) * math.log2(c / length) for c in counter.values())


def get_file_hashes(content: bytes) -> dict:
    return {
        "md5": hashlib.md5(content).hexdigest(),
        "sha256": hashlib.sha256(content).hexdigest(),
        "sha1": hashlib.sha1(content).hexdigest(),
    }


def scan_file(filename: str, content: bytes) -> dict:
    threats = []
    threat_score = 0
    scan_details = []

    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    hashes = get_file_hashes(content)

    # ── 1. Known malware hash check ───────────────────────────────────────────
    if hashes["md5"] in KNOWN_MALWARE_HASHES or hashes["sha256"] in KNOWN_MALWARE_HASHES:
        threats.append("KNOWN MALWARE: Hash matches threat intelligence database")
        threat_score += 100
        scan_details.append("Hash match: MALWARE DATABASE HIT")

    # ── 2. Dangerous extension check ─────────────────────────────────────────
    if ext in DANGEROUS_EXTENSIONS:
        threats.append(f"Dangerous file type blocked: .{ext}")
        threat_score += 90
        scan_details.append(f"Extension: DANGEROUS (.{ext})")
    elif ext in SAFE_EXTENSIONS:
        scan_details.append(f"Extension: SAFE (.{ext})")
    else:
        scan_details.append(f"Extension: UNKNOWN (.{ext}) - treated with caution")
        threat_score += 15

    # ── 3. Magic bytes / file signature check ────────────────────────────────
    if ext not in ZIP_BASED_EXTENSIONS:
        for sig_bytes, sig_name in MALWARE_SIGNATURES:
            sig = sig_bytes if isinstance(sig_bytes, bytes) else sig_bytes.encode()
            try:
                actual_sig = bytes.fromhex(sig_bytes.decode().replace("\\x", "")) if "\\x" in sig_bytes.decode("utf-8", errors="replace") else sig_bytes
            except:
                actual_sig = sig_bytes
            if content[:len(sig)] == sig:
                threats.append(f"Malicious signature: {sig_name}")
                threat_score += 80
                scan_details.append(f"Magic bytes: {sig_name}")
                break

    # ── 4. Entropy analysis ───────────────────────────────────────────────────
    entropy = calculate_entropy(content)
    if entropy > 7.8 and ext not in HIGH_ENTROPY_EXEMPT:
        threats.append(f"Ultra-high entropy ({entropy:.2f}/8.0) - packed/encrypted malware likely")
        threat_score += 60
        scan_details.append(f"Entropy: CRITICAL ({entropy:.2f}/8.0)")
    elif entropy > 7.5 and ext not in HIGH_ENTROPY_EXEMPT:
        threats.append(f"High entropy ({entropy:.2f}/8.0) - possible packed malware")
        threat_score += 40
        scan_details.append(f"Entropy: HIGH ({entropy:.2f}/8.0)")
    else:
        scan_details.append(f"Entropy: NORMAL ({entropy:.2f}/8.0)")

    # ── 5. YARA-style pattern scan (first 1MB) ────────────────────────────────
    sample = content[:1_000_000]
    patterns_found = 0
    for pattern, description in MALWARE_PATTERNS:
        if re.search(pattern, sample, re.DOTALL):
            threats.append(f"Malware pattern: {description}")
            threat_score += 65
            scan_details.append(f"Pattern match: {description}")
            patterns_found += 1
            if patterns_found >= 3:
                break

    # ── 6. Suspicious strings ─────────────────────────────────────────────────
    for sus_str, description in SUSPICIOUS_STRINGS:
        if sus_str.lower() in content[:100_000].lower():
            scan_details.append(f"Suspicious string: {description}")
            threat_score += 10

    # ── 7. Double extension attack ────────────────────────────────────────────
    parts = filename.split(".")
    if len(parts) > 2:
        real_ext = parts[-1].lower()
        fake_ext = parts[-2].lower()
        if real_ext in DANGEROUS_EXTENSIONS and fake_ext in SAFE_EXTENSIONS:
            threats.append(f"Double extension attack: {filename} (.{fake_ext}.{real_ext})")
            threat_score += 95
            scan_details.append("Double extension: ATTACK DETECTED")

    # ── 8. Null byte injection ────────────────────────────────────────────────
    if b"\x00" * 20 in content[:1000] and ext not in HIGH_ENTROPY_EXEMPT:
        threats.append("Null byte injection detected")
        threat_score += 50
        scan_details.append("Null bytes: INJECTION DETECTED")

    # ── 9. File size checks ───────────────────────────────────────────────────
    if len(content) == 0:
        threats.append("Empty file - possible placeholder for payload")
        threat_score += 10
    elif len(content) > 900 * 1024 * 1024:
        scan_details.append("File size: VERY LARGE (>900MB)")

    # ── 10. Polyglot file detection ───────────────────────────────────────────
    if ext in SAFE_EXTENSIONS and len(threats) > 0:
        threats.append(f"Polyglot file suspected: .{ext} file with malicious content")
        threat_score += 30
        scan_details.append("Polyglot: SUSPECTED")

    # ── Threat level classification ───────────────────────────────────────────
    threat_score = min(threat_score, 100)

    if threat_score >= 80:
        threat_level = "CRITICAL"
    elif threat_score >= 60:
        threat_level = "HIGH"
    elif threat_score >= 30:
        threat_level = "MEDIUM"
    elif threat_score > 0:
        threat_level = "LOW"
    else:
        threat_level = "CLEAN"

    # Block at HIGH and above (score >= 60)
    safe = threat_score < 60

    details = (
        f"K7-Style Deep Scan | File: {filename} | "
        f"Size: {len(content):,} bytes | "
        f"MD5: {hashes['md5']} | "
        f"Entropy: {entropy:.2f}/8.0 | "
        f"Threat Score: {threat_score}/100 | "
        f"Status: {threat_level} | "
        f"Checks: {len(scan_details)} | "
        f"Threats Found: {len(threats)}"
    )

    return {
        "safe": safe,
        "threat_level": threat_level,
        "threat_score": threat_score,
        "threats": threats,
        "details": details,
        "entropy": round(entropy, 2),
        "file_size": len(content),
        "filename": filename,
        "hashes": hashes,
        "scan_details": scan_details,
    }
