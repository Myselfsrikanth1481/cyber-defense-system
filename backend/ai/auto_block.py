import redis
from app.config import settings

try:
    r = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
    r.ping()
except Exception:
    r = None

def block_ip(ip, reason="ai_detected"):
    if not r:
        return
    try:
        r.setex(f"blocked:{ip}", 600, reason)
    except Exception:
        pass
