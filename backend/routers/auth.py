from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from jose import jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
from pydantic import BaseModel
import numpy as np
import json
import random
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from database import get_db
from models.user import User
from models.login_log import LoginLog
from app.config import settings
from app.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    role: str = "user"

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    email: str
    otp: str
    new_password: str


def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_token(username: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": username, "role": role, "exp": expire}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def create_temp_token(username: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=5)
    return jwt.encode({"sub": username, "role": role, "exp": expire, "temp": True}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def send_otp_email(to_email: str, otp: str, username: str):
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Your OTP - Cyber Defense System"
        msg["From"] = settings.SMTP_EMAIL
        msg["To"] = to_email
        html = f"""
        <html><body style="font-family:Arial,sans-serif;background:#080c10;color:#e8eaf0;padding:30px">
        <div style="max-width:480px;margin:auto;background:#0d1117;border:1px solid #1e3a2f;border-radius:12px;padding:32px">
            <h2 style="color:#00ff88">Cyber Defense System</h2>
            <p>Hi <b>{username}</b>,</p>
            <p>Your password reset OTP is:</p>
            <div style="font-size:36px;font-weight:700;letter-spacing:8px;color:#00ff88;text-align:center;padding:20px;background:#111820;border-radius:8px;margin:20px 0">
                {otp}
            </div>
            <p style="color:#4a6070;font-size:12px">This OTP expires in 10 minutes. Do not share it.</p>
        </div>
        </body></html>
        """
        msg.attach(MIMEText(html, "html"))
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_EMAIL, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_EMAIL, to_email, msg.as_string())
    except Exception as e:
        print(f"Email error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send OTP: {str(e)}")


async def get_ip_geo(ip: str) -> dict:
    try:
        import httpx
        if ip in ("127.0.0.1", "localhost", "::1"):
            return {"city": "Local", "country": "Local"}
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"http://ip-api.com/json/{ip}?fields=country,city")
            if resp.status_code == 200:
                data = resp.json()
                return {"city": data.get("city"), "country": data.get("country")}
    except:
        pass
    return {"city": None, "country": None}


async def log_login(db: AsyncSession, user: User, ip: str, status: str = "success", city: str = None, country: str = None):
    try:
        log = LoginLog(
            user_id=user.id,
            username=user.username,
            role=user.role,
            ip=ip,
            city=city,
            country=country,
            status=status,
        )
        db.add(log)
        await db.commit()
        print(f"[LOGIN LOG] {user.username} | {status} | {ip} | {city}, {country}")
    except Exception as e:
        print(f"Login log error: {e}")


@router.post("/register")
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    if data.role == "super_admin":
        raise HTTPException(status_code=403, detail="Super admin cannot be registered via API")
    if data.role not in ("admin", "user"):
        raise HTTPException(status_code=400, detail="Invalid role")

    result = await db.execute(select(User).where(User.username == data.username))
    existing_user = result.scalar_one_or_none()
    if existing_user:
        if verify_password(data.password, existing_user.hashed_password) and not existing_user.face_encoding:
            temp_token = create_temp_token(existing_user.username, existing_user.role)
            return {"message": "Resuming incomplete registration", "temp_token": temp_token, "resume": True}
        raise HTTPException(status_code=400, detail="Username already taken")

    result = await db.execute(select(User).where(User.email == data.email))
    existing_email = result.scalar_one_or_none()
    if existing_email:
        if verify_password(data.password, existing_email.hashed_password) and not existing_email.face_encoding:
            temp_token = create_temp_token(existing_email.username, existing_email.role)
            return {"message": "Resuming incomplete registration", "temp_token": temp_token, "resume": True}
        raise HTTPException(status_code=400, detail="Email already registered")

    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    user = User(
        username=data.username,
        email=data.email,
        hashed_password=hash_password(data.password),
        role=data.role,
        is_admin=(data.role in ("admin", "super_admin")),
    )
    db.add(user)
    await db.commit()
    temp_token = create_temp_token(data.username, data.role)
    return {"message": "Account created successfully", "temp_token": temp_token}


@router.post("/login")
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    ip = request.client.host

    result = await db.execute(select(User).where(User.username == form_data.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(form_data.password, user.hashed_password):
        # Log failed attempt if user exists
        if user:
            geo = await get_ip_geo(ip)
            await log_login(db, user, ip, "blocked", geo.get("city"), geo.get("country"))
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # -- Check if account is blocked -------------------------------------------
    if getattr(user, "is_blocked", False):
        geo = await get_ip_geo(ip)
        await log_login(db, user, ip, "blocked", geo.get("city"), geo.get("country"))
        raise HTTPException(
            status_code=403,
            detail=f"Your account has been blocked. Reason: {user.blocked_reason or 'Suspicious activity'}. Contact super admin."
        )

    # -- Update last login -----------------------------------------------------
    user.last_login = datetime.utcnow()
    user.last_login_ip = ip
    await db.commit()

    # -- Get geo info ----------------------------------------------------------
    geo = await get_ip_geo(ip)

    # -- Super admin � bypasses face ID, log and return full token -------------
    if user.role == "super_admin":
        await log_login(db, user, ip, "success", geo.get("city"), geo.get("country"))
        return {
            "status": "success",
            "access_token": create_token(user.username, user.role),
            "token_type": "bearer",
            "role": user.role,
        }

    # -- Log login for admin/user (face still required after this) -------------
    await log_login(db, user, ip, "success", geo.get("city"), geo.get("country"))

    # -- Face not registered ? incomplete registration -------------------------
    if not user.face_encoding:
        temp_token = create_temp_token(user.username, user.role)
        return {"status": "face_required", "temp_token": temp_token, "token_type": "bearer", "role": user.role}

    # -- Face registered ? require face verification ---------------------------
    temp_token = create_temp_token(user.username, user.role)
    return {"status": "face_required", "temp_token": temp_token, "token_type": "bearer", "role": user.role}


@router.post("/register-face")
async def register_face(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        import face_recognition
        import io
        from PIL import Image
        contents = await file.read()
        img = np.array(Image.open(io.BytesIO(contents)).convert("RGB"))
        encodings = face_recognition.face_encodings(img)
        if not encodings:
            raise HTTPException(status_code=400, detail="No face detected. Use a clear frontal photo.")
        encoding_bytes = json.dumps(encodings[0].tolist()).encode()
        result = await db.execute(select(User).where(User.id == current_user.id))
        user = result.scalar_one()
        user.face_encoding = encoding_bytes
        await db.commit()
        return {"message": "Face registered successfully.", "role": user.role}
    except Exception as e:
        print(f"FACE ERROR: {e}")
        raise HTTPException(status_code=501, detail=f"Face recognition error: {str(e)}")


@router.post("/verify-face")
async def verify_face(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.face_encoding:
        raise HTTPException(status_code=400, detail="No face registered for this account")
    try:
        import face_recognition
        import io
        from PIL import Image
        contents = await file.read()
        img = np.array(Image.open(io.BytesIO(contents)).convert("RGB"))
        known = np.array(json.loads(current_user.face_encoding.decode()))
        unknown_encodings = face_recognition.face_encodings(img)
        if not unknown_encodings:
            raise HTTPException(status_code=400, detail="No face detected in photo")
        match = face_recognition.compare_faces([known], unknown_encodings[0], tolerance=0.5)[0]
        if not match:
            raise HTTPException(status_code=401, detail="Face verification failed � not a match")
        return {
            "verified": True,
            "access_token": create_token(current_user.username, current_user.role),
            "token_type": "bearer",
            "role": current_user.role,
        }
    except Exception as e:
        print(f"FACE ERROR: {e}")
        raise HTTPException(status_code=501, detail=f"Face recognition error: {str(e)}")


@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user:
        return {"message": "If that email exists, an OTP has been sent."}
    otp = str(random.randint(100000, 999999))
    user.otp_code = otp
    user.otp_expiry = datetime.utcnow() + timedelta(minutes=10)
    await db.commit()
    send_otp_email(user.email, otp, user.username)
    return {"message": "OTP sent to your email address."}


@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Email not found")
    if not user.otp_code or user.otp_code != data.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    if not user.otp_expiry or datetime.utcnow() > user.otp_expiry.replace(tzinfo=None):
        raise HTTPException(status_code=400, detail="OTP has expired")
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    user.hashed_password = hash_password(data.new_password)
    user.otp_code = None
    user.otp_expiry = None
    await db.commit()
    return {"message": "Password reset successfully. Please login."}


@router.delete("/cancel-registration")
async def cancel_registration(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one()
    await db.delete(user)
    await db.commit()
    return {"message": "Account deleted."}


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role,
        "is_admin": current_user.is_admin,
        "is_blocked": getattr(current_user, "is_blocked", False),
        "has_face": current_user.face_encoding is not None,
        "created_at": str(current_user.created_at),
        "last_login": str(current_user.last_login),
        "last_login_ip": getattr(current_user, "last_login_ip", None),
    }


@router.post("/logout")
async def logout(request: Request, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    ip = request.client.host
    geo = await get_ip_geo(ip)
    try:
        from models.login_log import LoginLog
        log = LoginLog(
            user_id=current_user.id,
            username=current_user.username,
            role=current_user.role,
            ip=ip,
            city=geo.get("city"),
            country=geo.get("country"),
            status="logout",
        )
        db.add(log)
        await db.commit()
        print(f"[LOGOUT LOG] {current_user.username}")
    except Exception as e:
        print(f"Logout log error: {e}")
    return {"message": "Logged out successfully"}
