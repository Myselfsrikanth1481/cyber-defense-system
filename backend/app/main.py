from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import HTTPException

from middleware.ip_filter import ip_filter
from middleware.rate_limiter import rate_limiter
from middleware.ddos_guard import ddos_guard
from middleware.payload_guard import payload_guard
from ai.features import extract_features
from ai.detector import detect_anomaly
from ai.auto_block import block_ip
from routers import auth, admin, vault, documents, admin_invite     # ← added invite
from blockchain.web3_client import store_log_on_chain

import redis
import asyncio
import httpx
from app.config import settings

TEST_MODE = False

try:
    r = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
    r.ping()
except Exception:
    r = None

app = FastAPI(title="AI Cyber Defense System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(vault.router)
app.include_router(documents.router)
app.include_router(admin_invite.router)                              # ← added invite


@app.on_event("startup")
async def startup():
    try:
        from database import engine, Base
        import models.user
        import models.security_log
        import models.ip_blacklist
        import models.vault_item
        import models.shared_document
        import models.doc_transaction        # ✅ blockchain ledger table
        import models.admin_invite           # ✅ admin invite table
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("✅ Database tables created")
    except Exception as e:
        print(f"⚠️  DB startup error: {e}")

    try:
        from database import AsyncSessionLocal
        from models.user import User
        from sqlalchemy.future import select
        from passlib.context import CryptContext
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(User).where(User.role == "super_admin"))
            existing = result.scalar_one_or_none()
            if not existing:
                super_admin = User(
                    username=settings.SUPER_ADMIN_USERNAME,
                    email="superadmin@cyberdefense.local",
                    hashed_password=pwd_context.hash(settings.SUPER_ADMIN_PASSWORD),
                    role="super_admin",
                    is_admin=True,
                )
                db.add(super_admin)
                await db.commit()
                print("✅ Super admin account created")
            else:
                print("✅ Super admin already exists")
    except Exception as e:
        print(f"⚠️  Super admin creation error: {e}")


async def fetch_geo(ip: str) -> dict:
    """Fetch geolocation for an IP address."""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(
                f"http://ip-api.com/json/{ip}?fields=country,city,lat,lon,isp"
            )
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "country": data.get("country"),
                    "city": data.get("city"),
                    "latitude": data.get("lat"),
                    "longitude": data.get("lon"),
                    "isp": data.get("isp"),
                }
    except Exception:
        pass
    return {
        "country": None,
        "city": None,
        "latitude": None,
        "longitude": None,
        "isp": None,
    }


async def log_attack_to_db_and_chain(
    ip: str, attack_type: str, confidence: float, geo: dict
):
    try:
        import json
        from database import AsyncSessionLocal
        from models.security_log import SecurityLog

        if not geo.get("country"):
            geo = await fetch_geo(ip)

        chain_result = store_log_on_chain(ip, attack_type, confidence)

        # ── Retrieve cached fingerprint if available ──
        fp_data = {}
        try:
            if r:
                cached = r.get(f"fp:{ip}")
                if cached:
                    fp_data = json.loads(cached)
        except Exception:
            pass

        async with AsyncSessionLocal() as db:
            log = SecurityLog(
                ip=ip,
                attack_type=attack_type,
                confidence=confidence,
                country=geo.get("country"),
                city=geo.get("city"),
                latitude=geo.get("latitude"),
                longitude=geo.get("longitude"),
                isp=geo.get("isp"),
                blocked=True,
                tx_hash=chain_result.get("tx_hash"),
                block_number=chain_result.get("block_number"),
                # ── Fingerprint data ──
                attacker_id=fp_data.get("attacker_id"),
                ja3_hash=fp_data.get("ja3_hash"),
                http2_hash=fp_data.get("http2_hash"),
                client_guess=fp_data.get("client_guess"),
                bot_score=fp_data.get("bot_score"),
                behavior_pattern=fp_data.get("behavior_pattern"),
                tool_guess=fp_data.get("tool_guess"),
                attack_patterns=json.dumps(fp_data.get("attack_patterns", [])),
                payload_dna=fp_data.get("payload_dna"),
                sophistication=fp_data.get("sophistication"),
                threat_score=fp_data.get("threat_score"),
                threat_level=fp_data.get("threat_level"),
                fingerprint_conf=fp_data.get("fingerprint_conf"),
            )
            db.add(log)
            await db.commit()
            print(
                f"🔍 Logged: {attack_type} from {ip} "
                f"| Attacker: {fp_data.get('attacker_id', 'unknown')} "
                f"| Tool: {fp_data.get('tool_guess', 'unknown')} "
                f"| Threat: {fp_data.get('threat_level', 'unknown')}"
            )
    except Exception as e:
        print(f"Log pipeline error: {e}")

@app.middleware("http")
async def security_middleware(request: Request, call_next):
    ip = "unknown"
    try:
        ip = request.client.host
        if ip == "127.0.0.1":
            return await call_next(request)

        ip = await ip_filter(request)
        await rate_limiter(request, ip)
        await ddos_guard(request, ip)
        await payload_guard(request)

        rate_val = r.get(f"rate:{ip}") if r else None
        count = int(rate_val) if rate_val and str(rate_val).isdigit() else 1
        features = extract_features(request, ip, count)

        if detect_anomaly(features):
            block_ip(ip)
            geo_data = await fetch_geo(ip)
            asyncio.create_task(
                log_attack_to_db_and_chain(ip, "AI Anomaly", 0.95, geo_data)
            )
            return JSONResponse(
                status_code=403,
                content={"detail": "AI detected malicious activity — IP blocked"},
            )

        return await call_next(request)

    except HTTPException as e:
        detail = e.detail or ""
        attack_type = None
        if "SQL Injection" in detail:        attack_type = "SQL Injection"
        elif "XSS" in detail:               attack_type = "XSS Attack"
        elif "Path Traversal" in detail:    attack_type = "Path Traversal"
        elif "Command Injection" in detail:  attack_type = "Command Injection"
        elif "DDoS" in detail:              attack_type = "DDoS Attack"
        elif "Brute Force" in detail:       attack_type = "Brute Force"
        elif "Port Scan" in detail:         attack_type = "Port Scan"
        elif "Rate Limit" in detail:        attack_type = "Rate Limit Exceeded"
        elif "Blocked" in detail:           attack_type = "Blocked IP"

        if attack_type:
            print(f"🚨 {attack_type} detected from {ip}")
            geo_data = await fetch_geo(ip)
            asyncio.create_task(
                log_attack_to_db_and_chain(ip, attack_type, 0.99, geo_data)
            )

        return JSONResponse(
            status_code=e.status_code, content={"detail": e.detail}
        )

    except Exception as e:
        print(f"Middleware error: {e}")
        return await call_next(request)


@app.get("/")
async def root():
    return {"status": "Cyber Defense System Running", "version": "3.0"}