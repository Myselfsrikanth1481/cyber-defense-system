import redis
from fastapi import Request, HTTPException
from app.config import settings
from collections import defaultdict
import time

try:
    r = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
    r.ping()
except:
    r = None

# In-memory brute force tracker: {ip: [(timestamp, path), ...]}
_login_attempts: dict = defaultdict(list)
BRUTE_FORCE_LIMIT = 10   # max failed-ish login hits
BRUTE_FORCE_WINDOW = 60  # seconds

LOGIN_PATHS = {"/auth/login", "/auth/verify-face"}

async def rate_limiter(request: Request, ip: str):
    try:
        if not r:
            return

        # ── Brute force detection on login endpoints ──
        if request.url.path in LOGIN_PATHS:
            now = time.time()
            attempts = _login_attempts[ip]
            # Keep only attempts within the window
            attempts = [t for t in attempts if now - t < BRUTE_FORCE_WINDOW]
            attempts.append(now)
            _login_attempts[ip] = attempts

            print(f"[BRUTE FORCE] IP: {ip} | Login attempts: {len(attempts)}")

            if len(attempts) > BRUTE_FORCE_LIMIT:
                print(f"🚨 BRUTE FORCE DETECTED: {ip}")
                if r:
                    r.setex(f"blocked:{ip}", 600, "brute_force")
                raise HTTPException(
                    status_code=429,
                    detail="Brute Force Attack detected — IP blocked"
                )

        # ── General rate limiting ──
        key = f"rate:{ip}"
        count = r.incr(key)
        if count == 1:
            r.expire(key, 60)

        print(f"[RATE LIMIT] IP: {ip} | Count: {count}")

        if count > settings.RATE_LIMIT:
            print(f"🚨 RATE LIMIT TRIGGERED for {ip}")
            raise HTTPException(status_code=429, detail="Rate Limit Exceeded")

    except HTTPException:
        raise
    except Exception as e:
        print("🔥 Rate limiter error:", str(e))