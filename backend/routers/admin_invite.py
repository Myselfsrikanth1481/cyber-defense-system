from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone
from database import get_db
from models.admin_invite import AdminInvite
from models.user import User
from app.dependencies import get_current_user
import secrets

router = APIRouter(prefix="/admin-invite", tags=["Admin Invite"])


# ── Auth guard ──
def require_super_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin only")
    return current_user


# ── Email sender via Gmail SMTP ──
async def send_registration_email(to_email: str, code: str, name: str):
    from app.config import settings
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    print(f"\n📧 Sending registration code to {name} ({to_email}) — Code: {code}\n")

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Your Admin Registration Code — Cyber Defense System"
        msg["From"] = settings.SMTP_EMAIL
        msg["To"] = to_email

        html = f"""
        <html>
        <body style="font-family:Arial,sans-serif;background:#080c10;color:#e8eaf0;padding:30px;margin:0">
          <div style="max-width:480px;margin:auto;background:#0d1117;border:1px solid #1e3a2f;border-radius:12px;padding:32px">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
              <span style="font-size:32px">🛡️</span>
              <div>
                <div style="color:#e8eaf0;font-size:18px;font-weight:800;letter-spacing:0.1em">CYBER DEFENSE</div>
                <div style="color:#00ff88;font-size:10px;letter-spacing:0.2em">SYSTEM v3.0</div>
              </div>
            </div>
            <hr style="border:none;border-top:1px solid #1e3a2f;margin:16px 0"/>
            <h2 style="color:#00ff88;font-size:16px;margin:0 0 16px">Admin Registration Invite</h2>
            <p style="color:#c8cad0;font-size:14px">Hi <b style="color:#e8eaf0">{name}</b>,</p>
            <p style="color:#c8cad0;font-size:14px">
              You have been invited to join the <b>Cyber Defense System</b> as an
              <b style="color:#00ff88">Admin</b>.
              Use the code below to complete your registration.
            </p>
            <div style="background:#111820;border:1px solid #1e3a2f;border-radius:10px;padding:24px;text-align:center;margin:24px 0">
              <div style="color:#6b8090;font-size:11px;letter-spacing:0.15em;margin-bottom:12px">
                YOUR REGISTRATION CODE
              </div>
              <div style="font-size:36px;font-weight:800;letter-spacing:0.4em;color:#00ff88;font-family:monospace">
                {code}
              </div>
            </div>
            <p style="color:#c8cad0;font-size:13px">
              Visit the registration page and enter this code to set up your account:
            </p>
            <div style="background:#111820;border-radius:8px;padding:12px 16px;margin:12px 0">
              <a href="http://localhost:5173/admin-register"
                 style="color:#00ff88;font-size:13px;font-family:monospace;text-decoration:none">
                http://localhost:5173/admin-register
              </a>
            </div>
            <hr style="border:none;border-top:1px solid #1e3a2f;margin:20px 0"/>
            <p style="color:#4a6070;font-size:11px;margin:0">
              ⏰ This code expires in <b>48 hours</b>.<br/>
              🔒 Do not share this code with anyone.<br/>
              If you did not expect this, please ignore this email.
            </p>
          </div>
        </body>
        </html>
        """

        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_EMAIL, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_EMAIL, to_email, msg.as_string())

        print(f"✅ Registration email sent to {to_email}")

    except Exception as e:
        print(f"⚠️ Email send error: {e}")


# ── Schemas ──
class CreateInviteRequest(BaseModel):
    name: str
    email: str
    phone: str

class VerifyCodeRequest(BaseModel):
    code: str

class SetPasswordRequest(BaseModel):
    code: str
    password: str


# ── Super Admin: Create invite ──
@router.post("/create")
async def create_invite(
    body: CreateInviteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered as a user")

    existing_inv = await db.execute(
        select(AdminInvite).where(AdminInvite.email == body.email, AdminInvite.used == False)
    )
    if existing_inv.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="A pending invite already exists for this email")

    code = secrets.token_hex(4).upper()
    expires_at = datetime.now(timezone.utc) + timedelta(hours=48)

    invite = AdminInvite(
        name=body.name,
        email=body.email,
        phone=body.phone,
        invite_code=code,
        approved=False,
        used=False,
        created_by=current_user.id,
        expires_at=expires_at,
    )
    db.add(invite)
    await db.commit()
    await db.refresh(invite)

    return {
        "message": "Invite created. Pending your approval.",
        "invite_id": invite.id,
        "name": invite.name,
        "email": invite.email,
        "phone": invite.phone,
        "code": code,
    }


# ── Super Admin: Get all pending invites ──
@router.get("/pending")
async def get_pending_invites(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    result = await db.execute(
        select(AdminInvite).where(AdminInvite.used == False).order_by(AdminInvite.created_at.desc())
    )
    invites = result.scalars().all()
    return [
        {
            "id": inv.id,
            "name": inv.name,
            "email": inv.email,
            "phone": inv.phone,
            "code": inv.invite_code,
            "approved": inv.approved,
            "used": inv.used,
            "created_at": inv.created_at,
            "expires_at": inv.expires_at,
        }
        for inv in invites
    ]


# ── Super Admin: Approve invite → sends email ──
@router.post("/approve/{invite_id}")
async def approve_invite(
    invite_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    result = await db.execute(select(AdminInvite).where(AdminInvite.id == invite_id))
    invite = result.scalar_one_or_none()

    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite.used:
        raise HTTPException(status_code=400, detail="Invite already used")
    if invite.approved:
        raise HTTPException(status_code=400, detail="Invite already approved")

    invite.approved = True
    invite.approved_at = datetime.now(timezone.utc)
    await db.commit()

    await send_registration_email(invite.email, invite.invite_code, invite.name)

    return {"message": f"Approved! Registration email sent to {invite.email}"}


# ── Super Admin: Reject invite ──
@router.delete("/reject/{invite_id}")
async def reject_invite(
    invite_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    result = await db.execute(select(AdminInvite).where(AdminInvite.id == invite_id))
    invite = result.scalar_one_or_none()

    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite.used:
        raise HTTPException(status_code=400, detail="Cannot reject a used invite")

    await db.delete(invite)
    await db.commit()
    return {"message": "Invite rejected and deleted"}


# ── Public: Verify code (no auth needed) ──
@router.post("/verify-code")
async def verify_code(
    body: VerifyCodeRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AdminInvite).where(AdminInvite.invite_code == body.code.upper())
    )
    invite = result.scalar_one_or_none()

    if not invite:
        raise HTTPException(status_code=404, detail="Invalid code")
    if not invite.approved:
        raise HTTPException(status_code=403, detail="This invite has not been approved yet")
    if invite.used:
        raise HTTPException(status_code=400, detail="This code has already been used")
    if invite.expires_at:
     expires = invite.expires_at.replace(tzinfo=timezone.utc) if invite.expires_at.tzinfo is None else invite.expires_at
    if datetime.now(timezone.utc) > expires:
        raise HTTPException(status_code=400, detail="This code has expired")

    return {
        "valid": True,
        "name": invite.name,
        "email": invite.email,
        "phone": invite.phone,
    }


# ── Public: Set password → creates admin user ──
@router.post("/set-password")
async def set_password(
    body: SetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    result = await db.execute(
        select(AdminInvite).where(AdminInvite.invite_code == body.code.upper())
    )
    invite = result.scalar_one_or_none()

    if not invite or not invite.approved or invite.used:
        raise HTTPException(status_code=400, detail="Invalid or expired invite")
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    username = invite.name.lower().replace(" ", "_")

    existing = await db.execute(select(User).where(User.username == username))
    if existing.scalar_one_or_none():
        username = f"{username}_{secrets.token_hex(2)}"

    new_admin = User(
        username=username,
        email=invite.email,
        phone=invite.phone,
        hashed_password=pwd_context.hash(body.password),
        role="admin",
        is_admin=True,
    )
    db.add(new_admin)

    invite.used = True
    invite.used_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(new_admin)

    from routers.auth import create_temp_token
    temp_token = create_temp_token(new_admin.username, new_admin.role)

    return {
        "message": "Password set. Proceed to face scan.",
        "user_id": new_admin.id,
        "username": new_admin.username,
        "temp_token": temp_token,
    }