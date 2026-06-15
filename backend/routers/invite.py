from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import jwt
import random, string

from database import get_db
from models.admin_invite import AdminInvite
from models.user import User
from app.config import settings
from app.dependencies import get_current_user

router = APIRouter(prefix="/invite", tags=["invite"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Helpers ────────────────────────────────────────────────────────────────────

def generate_invite_code(length: int = 8) -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=length))

def create_temp_token(username: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=10)
    return jwt.encode(
        {"sub": username, "role": role, "exp": expire, "temp": True},
        settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )

def create_token(username: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": username, "role": role, "exp": expire},
        settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )

def send_sms(phone: str, message: str):
    """Send SMS via Twilio. Prints to console if Twilio not configured (dev mode)."""
    try:
        from twilio.rest import Client
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        client.messages.create(
            body=message,
            from_=settings.TWILIO_PHONE_NUMBER,
            to=phone,
        )
        print(f"✅ SMS sent to {phone}")
    except Exception as e:
        print(f"📱 [DEV SMS to {phone}]: {message}")
        print(f"   Twilio not configured: {e}")


# ── Request Models ─────────────────────────────────────────────────────────────

class CreateInviteRequest(BaseModel):
    name: str
    email: str
    phone: str   # E.164 format: +91XXXXXXXXXX

class RegisterWithCodeRequest(BaseModel):
    invite_code: str
    password: str
    confirm_password: str


# ══════════════════════════════════════════════════════════════════════════════
# SUPER ADMIN ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/create")
async def create_invite(
    data: CreateInviteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Super admin creates an invite — status starts as pending (needs approval)."""
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can create invites")

    # Block if email already a registered user
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered as a user")

    # Block if active invite already exists for this email
    result = await db.execute(
        select(AdminInvite).where(
            AdminInvite.email == data.email,
            AdminInvite.status.in_(["pending", "approved"])
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="An active invite already exists for this email")

    # Generate unique code
    while True:
        code = generate_invite_code()
        result = await db.execute(select(AdminInvite).where(AdminInvite.invite_code == code))
        if not result.scalar_one_or_none():
            break

    invite = AdminInvite(
        name=data.name,
        email=data.email,
        phone=data.phone,
        invite_code=code,
        status="pending",
        created_by=current_user.username,
    )
    db.add(invite)
    await db.commit()
    await db.refresh(invite)

    return {
        "message": "Invite created successfully. Review and approve to send SMS to user.",
        "invite_id": invite.id,
        "invite_code": code,
        "name": data.name,
        "email": data.email,
        "phone": data.phone,
        "status": "pending",
    }


@router.post("/approve/{invite_id}")
async def approve_invite(
    invite_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Super admin approves invite → SMS with code sent to user's phone."""
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can approve invites")

    result = await db.execute(select(AdminInvite).where(AdminInvite.id == invite_id))
    invite = result.scalar_one_or_none()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite.status != "pending":
        raise HTTPException(status_code=400, detail=f"Invite is already {invite.status}")

    invite.status = "approved"
    invite.approved_at = datetime.utcnow()
    invite.expires_at = datetime.utcnow() + timedelta(hours=48)
    await db.commit()

    message = (
        f"Hi {invite.name}! You have been invited to join Cyber Defense System as an Admin.\n"
        f"Your registration code is: {invite.invite_code}\n"
        f"Visit the registration page, click 'Admin Invite Code' and enter this code.\n"
        f"This code expires in 48 hours. Do not share it."
    )
    send_sms(invite.phone, message)

    return {
        "message": f"Invite approved! SMS sent to {invite.phone}",
        "invite_code": invite.invite_code,
        "expires_at": str(invite.expires_at),
    }


@router.post("/reject/{invite_id}")
async def reject_invite(
    invite_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Super admin rejects an invite."""
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can reject invites")

    result = await db.execute(select(AdminInvite).where(AdminInvite.id == invite_id))
    invite = result.scalar_one_or_none()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite.status not in ("pending", "approved"):
        raise HTTPException(status_code=400, detail=f"Cannot reject invite with status: {invite.status}")

    invite.status = "rejected"
    await db.commit()
    return {"message": "Invite rejected"}


@router.get("/list")
async def list_invites(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Super admin views all invites."""
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can view invites")

    result = await db.execute(select(AdminInvite).order_by(AdminInvite.created_at.desc()))
    invites = result.scalars().all()
    return [
        {
            "id": inv.id,
            "name": inv.name,
            "email": inv.email,
            "phone": inv.phone,
            "invite_code": inv.invite_code,
            "status": inv.status,
            "created_by": inv.created_by,
            "created_at": str(inv.created_at),
            "approved_at": str(inv.approved_at) if inv.approved_at else None,
            "expires_at": str(inv.expires_at) if inv.expires_at else None,
            "used_at": str(inv.used_at) if inv.used_at else None,
        }
        for inv in invites
    ]


@router.delete("/delete/{invite_id}")
async def delete_invite(
    invite_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Super admin deletes an invite."""
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can delete invites")

    result = await db.execute(select(AdminInvite).where(AdminInvite.id == invite_id))
    invite = result.scalar_one_or_none()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    await db.delete(invite)
    await db.commit()
    return {"message": "Invite deleted"}


# ══════════════════════════════════════════════════════════════════════════════
# PUBLIC ENDPOINTS (used by invited admin during registration)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/verify-code")
async def verify_invite_code(
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    """
    User enters their invite code.
    Returns pre-filled name + email (shown locked on frontend).
    """
    code = payload.get("invite_code", "").strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="Invite code is required")

    result = await db.execute(select(AdminInvite).where(AdminInvite.invite_code == code))
    invite = result.scalar_one_or_none()

    if not invite:
        raise HTTPException(status_code=404, detail="Invalid invite code")
    if invite.status == "pending":
        raise HTTPException(status_code=403, detail="This invite has not been approved yet by the super admin")
    if invite.status == "rejected":
        raise HTTPException(status_code=403, detail="This invite has been rejected by the super admin")
    if invite.status == "used":
        raise HTTPException(status_code=400, detail="This invite code has already been used")
    if invite.status != "approved":
        raise HTTPException(status_code=400, detail="Invalid invite status")

    if invite.expires_at and datetime.utcnow() > invite.expires_at.replace(tzinfo=None):
        invite.status = "rejected"
        await db.commit()
        raise HTTPException(status_code=400, detail="Invite code has expired. Contact super admin for a new one.")

    return {
        "valid": True,
        "name": invite.name,
        "email": invite.email,
        "invite_id": invite.id,
    }


@router.post("/complete-registration")
async def complete_invite_registration(
    data: RegisterWithCodeRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    User sets their password using invite code.
    Creates admin account → returns temp_token for face setup.
    """
    code = data.invite_code.strip().upper()

    result = await db.execute(select(AdminInvite).where(AdminInvite.invite_code == code))
    invite = result.scalar_one_or_none()

    if not invite or invite.status != "approved":
        raise HTTPException(status_code=400, detail="Invalid or expired invite code")

    if invite.expires_at and datetime.utcnow() > invite.expires_at.replace(tzinfo=None):
        invite.status = "rejected"
        await db.commit()
        raise HTTPException(status_code=400, detail="Invite code has expired")

    if data.password != data.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    # Check if user already partially created (resume face setup)
    result = await db.execute(select(User).where(User.email == invite.email))
    existing_user = result.scalar_one_or_none()

    if existing_user and existing_user.face_encoding:
        raise HTTPException(status_code=400, detail="Admin already fully registered. Please login.")

    if existing_user and not existing_user.face_encoding:
        # Resume — update password and return temp token for face setup
        existing_user.hashed_password = pwd_context.hash(data.password)
        await db.commit()
        temp_token = create_temp_token(existing_user.username, existing_user.role)
        return {"message": "Resuming face setup", "temp_token": temp_token, "resume": True}

    # Generate username from name
    base_username = invite.name.lower().replace(" ", "_")
    username = base_username
    counter = 1
    while True:
        result = await db.execute(select(User).where(User.username == username))
        if not result.scalar_one_or_none():
            break
        username = f"{base_username}_{counter}"
        counter += 1

    user = User(
        username=username,
        email=invite.email,
        hashed_password=pwd_context.hash(data.password),
        role="admin",
        is_admin=True,
        phone=invite.phone,
    )
    db.add(user)

    invite.status = "used"
    invite.used_at = datetime.utcnow()
    await db.commit()
    await db.refresh(user)

    temp_token = create_temp_token(user.username, user.role)
    return {
        "message": "Account created. Please complete face ID setup.",
        "temp_token": temp_token,
        "username": user.username,
    }