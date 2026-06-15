import asyncio
from database import AsyncSessionLocal, engine
from models.security_log import SecurityLog
from models.ip_blacklist import IPBlacklist
from sqlalchemy import text

async def seed():
    # Force add columns if missing
    async with engine.begin() as conn:
        cols = ['attacker_id VARCHAR', 'ja3_hash VARCHAR', 'http2_hash VARCHAR',
                'client_guess VARCHAR', 'bot_score INTEGER', 'behavior_pattern VARCHAR',
                'tool_guess VARCHAR', 'attack_patterns TEXT', 'payload_dna VARCHAR',
                'sophistication INTEGER', 'threat_score INTEGER', 'threat_level VARCHAR',
                'fingerprint_conf INTEGER']
        for col in cols:
            try:
                await conn.execute(text(f'ALTER TABLE security_logs ADD COLUMN {col}'))
            except: pass

    async with AsyncSessionLocal() as db:
        attacks = [
            {"ip": "185.220.101.45", "attack_type": "SQL Injection", "confidence": 0.99, "country": "Russia", "city": "Moscow", "latitude": 55.7558, "longitude": 37.6176, "isp": "Tor Exit Node", "blocked": True},
            {"ip": "103.21.244.0", "attack_type": "XSS Attack", "confidence": 0.97, "country": "China", "city": "Beijing", "latitude": 39.9042, "longitude": 116.4074, "isp": "Alibaba Cloud", "blocked": True},
            {"ip": "91.108.4.0", "attack_type": "DDoS Attack", "confidence": 0.95, "country": "Germany", "city": "Frankfurt", "latitude": 50.1109, "longitude": 8.6821, "isp": "Hetzner Online", "blocked": True},
            {"ip": "198.51.100.5", "attack_type": "Brute Force", "confidence": 0.93, "country": "United States", "city": "New York", "latitude": 40.7128, "longitude": -74.0060, "isp": "DigitalOcean", "blocked": True},
            {"ip": "45.33.32.156", "attack_type": "Port Scan", "confidence": 0.91, "country": "Netherlands", "city": "Amsterdam", "latitude": 52.3676, "longitude": 4.9041, "isp": "Linode", "blocked": True},
            {"ip": "192.168.1.100", "attack_type": "SQL Injection", "confidence": 0.88, "country": "India", "city": "Mumbai", "latitude": 19.0760, "longitude": 72.8777, "isp": "Jio Fiber", "blocked": True},
            {"ip": "77.88.55.66", "attack_type": "Path Traversal", "confidence": 0.96, "country": "Ukraine", "city": "Kyiv", "latitude": 50.4501, "longitude": 30.5234, "isp": "Yandex Cloud", "blocked": True},
            {"ip": "104.244.72.115", "attack_type": "XSS Attack", "confidence": 0.94, "country": "Brazil", "city": "Sao Paulo", "latitude": -23.5505, "longitude": -46.6333, "isp": "Twitter CDN", "blocked": True},
        ]

        for a in attacks:
            db.add(SecurityLog(**a))

        for ip, reason in [
            ("185.220.101.45", "SQL Injection"),
            ("103.21.244.0", "XSS Attack"),
            ("91.108.4.0", "DDoS Attack"),
            ("45.33.32.156", "Port Scan"),
        ]:
            db.add(IPBlacklist(ip=ip, reason=reason, blocked_by="AI System"))

        await db.commit()
        print("Seeded successfully!")

asyncio.run(seed())
