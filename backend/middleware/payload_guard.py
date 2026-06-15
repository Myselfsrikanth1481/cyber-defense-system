from fastapi import Request, HTTPException
import re

MAX_SIZE = 50 * 1024 * 1024  # 50MB

# SQL Injection patterns
SQL_PATTERNS = [
    r"(?i)(union\s+select)",
    r"(?i)(drop\s+table)",
    r"(?i)(insert\s+into)",
    r"(?i)(delete\s+from)",
    r"(?i)(1\s*=\s*1)",
    r"(?i)(or\s+1\s*=\s*1)",
    r"(?i)(select\s+\*\s+from)",
    r"(?i)(exec\s*\()",
    r"(?i)(xp_cmdshell)",
    r"(?i)(;\s*drop\s)",
    r"(?i)(--\s*$)",
    r"(?i)(/\*.*\*/)",
]

# XSS patterns
XSS_PATTERNS = [
    r"(?i)(<script[\s>])",
    r"(?i)(</script>)",
    r"(?i)(javascript\s*:)",
    r"(?i)(onerror\s*=)",
    r"(?i)(onload\s*=)",
    r"(?i)(onclick\s*=)",
    r"(?i)(alert\s*\()",
    r"(?i)(document\.cookie)",
    r"(?i)(document\.write)",
    r"(?i)(<iframe[\s>])",
    r"(?i)(eval\s*\()",
    r"(?i)(expression\s*\()",
]

# Path Traversal patterns
PATH_TRAVERSAL_PATTERNS = [
    r"\.\./",
    r"\.\.\\",
    r"(?i)(%2e%2e%2f)",
    r"(?i)(%2e%2e/)",
    r"(?i)(\.\.%2f)",
    r"(?i)(/etc/passwd)",
    r"(?i)(c:\\windows)",
]

# Command Injection patterns
CMD_INJECTION_PATTERNS = [
    r"(?i)(;\s*ls\s)",
    r"(?i)(;\s*cat\s)",
    r"(?i)(;\s*rm\s)",
    r"(?i)(\|\s*nc\s)",
    r"(?i)(&&\s*whoami)",
    r"(?i)(`whoami`)",
    r"(?i)(\$\(id\))",
]

EXEMPT_PATHS = {
    "/auth/login", "/auth/register",
    "/auth/register-face", "/auth/verify-face",
    "/auth/forgot-password", "/auth/reset-password",
}

def detect_attack_type(body_str: str, path: str) -> str | None:
    for p in SQL_PATTERNS:
        if re.search(p, body_str):
            return "SQL Injection"
    for p in XSS_PATTERNS:
        if re.search(p, body_str):
            return "XSS Attack"
    for p in PATH_TRAVERSAL_PATTERNS:
        if re.search(p, body_str) or re.search(p, path):
            return "Path Traversal"
    for p in CMD_INJECTION_PATTERNS:
        if re.search(p, body_str):
            return "Command Injection"
    return None

async def payload_guard(request: Request):
    if request.url.path in EXEMPT_PATHS:
        return

    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="Payload too large")

    body = await request.body()
    if not body:
        # Still check URL path for path traversal
        attack = detect_attack_type("", request.url.path)
        if attack:
            print(f"🚨 {attack} detected in URL: {request.url.path}")
            raise HTTPException(status_code=400, detail=f"{attack} detected")
        return

    body_str = body.decode(errors="ignore")
    attack = detect_attack_type(body_str, request.url.path)
    if attack:
        print(f"🚨 {attack} detected from payload")
        raise HTTPException(status_code=400, detail=f"{attack} detected")