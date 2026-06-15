import redis
from fastapi import Request, HTTPException
from app.config import settings

try:
    r = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
    r.ping()
except:
    r = None

async def ddos_guard(request: Request, ip: str):
    try:
        if not r:
            return

        if r.exists(f"blocked:{ip}"):
            print(f"⛔ BLOCKED IP ATTEMPT: {ip}")
            raise HTTPException(status_code=403, detail="IP is blocked")

        key = f"ddos:{ip}"
        count = r.incr(key)
        if count == 1:
            r.expire(key, 10)

        print(f"[DDOS] IP: {ip} | Count: {count}")

        if count > settings.DDOS_THRESHOLD:
            print(f"🚨 DDOS DETECTED: {ip}")
            r.setex(f"blocked:{ip}", 600, "ddos")
            raise HTTPException(status_code=403, detail="DDoS Attack detected — IP blocked")

    except HTTPException:
        raise
    except Exception as e:
        print("🔥 DDoS guard error:", str(e))