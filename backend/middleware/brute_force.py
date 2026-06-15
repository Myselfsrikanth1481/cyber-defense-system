import redis
from app.config import settings

try:
    r = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
    r.ping()
except Exception:
    r = None

def record_failed_attempt(ip: str):
    if not r:
        return
    try:
        key = f"bf:{ip}"
        count = r.incr(key)
        if count == 1:
            r.expire(key, 900)  # 15 min window
        if count >= 5:
            r.setex(f"blocked:{ip}", 900, "bruteforce")
    except Exception:
        pass

def reset_attempts(ip: str):
    if not r:
        return
    try:
        r.delete(f"bf:{ip}")
    except Exception:
        pass
