# 🛡️ AI Cyber Defense System — Setup Guide

## Architecture
- **Backend**: FastAPI (Python) — port 8000
- **Frontend**: React + Vite — port 3000
- **Database**: PostgreSQL (or SQLite for quick start)
- **Cache**: Redis (optional — system degrades gracefully without it)

---

## Quick Start (Recommended)

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL running locally **OR** use SQLite mode (see below)

---

## Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Install face recognition (requires cmake + dlib)
# On Ubuntu/Debian:
#   sudo apt-get install cmake libdlib-dev
#   pip install face_recognition
# On macOS:
#   brew install cmake
#   pip install face_recognition
# On Windows:
#   Install Visual C++ build tools, then:
#   pip install cmake dlib face_recognition

# Configure environment
cp .env.example .env
# Edit .env with your DB URL, secret key, etc.

# Start server (tables are created automatically on startup)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### SQLite Quick-Start (no PostgreSQL needed)
Edit `app/config.py` and change:
```python
DATABASE_URL: str = "sqlite+aiosqlite:///./cyberdb.sqlite"
```
Then: `pip install aiosqlite`

---

## Frontend Setup

```bash
cd frontend

npm install
npm run dev
# Open http://localhost:3000
```

---

## First Use Flow

1. Open http://localhost:3000
2. Click **Register here**
3. Create username + password
4. **Step 2 — Face ID Setup**: Use camera or upload a photo
   - This makes your account phishing-proof
   - Even if an attacker steals your password, they cannot login without your face
5. Go to Login → enter credentials → face verification step → dashboard

---

## Security Features

| Feature | Description |
|---|---|
| Face Recognition MFA | Anti-phishing: password + face required |
| AI Anomaly Detection | IsolationForest ML model detects attack patterns |
| DDoS Guard | Rate limiting + request frequency analysis |
| IP Blacklist | Manual + automatic IP blocking with Redis |
| Payload Guard | SQL injection + XSS pattern detection |
| Brute Force Protection | 5 failed attempts → 15min lockout |
| Blockchain Logging | Tamper-proof attack logs (mock mode if Ganache not running) |
| AES-256 Vault | Encrypted file storage per user |

---

## Environment Variables (.env)

```env
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/cyberdb
REDIS_URL=redis://localhost:6379
SECRET_KEY=change-this-to-a-long-random-string
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
RATE_LIMIT=100
DDOS_THRESHOLD=500
```

---

## Troubleshooting

**"Face recognition library not installed"** — Install cmake + dlib + face_recognition (see above). Face login falls back gracefully if not installed.

**Redis connection errors** — Redis is optional. The system runs without it (IP blocking and rate limiting are disabled).

**Database tables not created** — Tables are auto-created on startup. Check `uvicorn` console for errors.

**CORS errors in browser** — Backend allows all origins by default. If using a reverse proxy, ensure CORS headers pass through.
