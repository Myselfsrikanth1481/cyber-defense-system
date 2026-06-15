from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "Cyber Defense System"
    DATABASE_URL: str = "sqlite+aiosqlite:///./cyberdb.sqlite"
    REDIS_URL: str = "redis://localhost:6379"
    SECRET_KEY: str = "supersecretkey-change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    RATE_LIMIT: int = 100
    DDOS_THRESHOLD: int = 500
    MODEL_PATH: str = "backend/ai/model.pkl"
    WEB3_PROVIDER: str = "http://127.0.0.1:7545"
    CONTRACT_ADDRESS: str = ""
    ABI_PATH: str = "backend/blockchain/abi.json"

    # Gmail SMTP for OTP
    SMTP_EMAIL: str = "3011abhi2004@gmail.com"
    SMTP_PASSWORD: str = "dmxf zbik udlg onxf"
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587

    # Twilio SMS
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE_NUMBER: str = ""

    # Super Admin (created once on startup)
    SUPER_ADMIN_USERNAME: str = "BSKPS_SUPERADMIN_9164658300"
    SUPER_ADMIN_PASSWORD: str = "223334491646583004455555"

    class Config:
        env_file = ".env"

settings = Settings()