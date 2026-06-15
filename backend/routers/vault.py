from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os

from database import get_db
from models.vault_item import VaultItem
from app.dependencies import get_current_user
from app.config import settings
from services.scanner import scan_file

router = APIRouter(prefix="/vault", tags=["vault"])

AES_KEY = os.urandom(32)

def encrypt(data: bytes):
    iv = os.urandom(12)
    aesgcm = AESGCM(AES_KEY)
    return aesgcm.encrypt(iv, data, None), iv

def decrypt(data: bytes, iv: bytes):
    aesgcm = AESGCM(AES_KEY)
    return aesgcm.decrypt(iv, data, None)

@router.get("/items")
async def list_items(db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    result = await db.execute(select(VaultItem).where(VaultItem.user_id == current_user.id))
    items = result.scalars().all()
    return [{"id": i.id, "filename": i.filename, "size": i.size, "uploaded_at": str(i.uploaded_at)} for i in items]

@router.post("/upload")
async def upload_file(file: UploadFile = File(...), db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    content = await file.read()

    if len(content) > 1024 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 1GB)")

    # ── AI Deep Security Scan on Upload ──
    scan = scan_file(file.filename, content)
    if not scan["safe"]:
        raise HTTPException(
            status_code=422,
            detail={
                "blocked": True,
                "reason": "File blocked by AI security scan",
                "threat_level": scan["threat_level"],
                "threat_score": scan["threat_score"],
                "threats": scan["threats"],
                "details": scan["details"],
            }
        )

    encrypted, iv = encrypt(content)
    item = VaultItem(
        user_id=current_user.id,
        filename=file.filename,
        encrypted_data=encrypted,
        iv=iv,
        size=len(content)
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return {
        "id": item.id,
        "filename": item.filename,
        "size": item.size,
        "message": "File scanned clean and encrypted (AES-256)",
        "scan": {
            "status": scan["threat_level"],
            "entropy": scan["entropy"],
            "threat_score": scan["threat_score"],
        }
    }

@router.get("/download/{item_id}")
async def download_file(item_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    result = await db.execute(select(VaultItem).where(VaultItem.id == item_id, VaultItem.user_id == current_user.id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="File not found")

    decrypted = decrypt(item.encrypted_data, item.iv)

    # ── AI Deep Security Scan on Download ──
    scan = scan_file(item.filename, decrypted)
    if not scan["safe"]:
        # Auto-delete dangerous file
        await db.delete(item)
        await db.commit()
        raise HTTPException(
            status_code=422,
            detail={
                "blocked": True,
                "reason": "File blocked on download — threat detected. File has been deleted.",
                "threat_level": scan["threat_level"],
                "threats": scan["threats"],
            }
        )

    return Response(
        content=decrypted,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename={item.filename}"}
    )

@router.get("/scan/{item_id}")
async def scan_vault_item(item_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    """Manual scan of a vault item."""
    result = await db.execute(select(VaultItem).where(VaultItem.id == item_id, VaultItem.user_id == current_user.id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="File not found")

    decrypted = decrypt(item.encrypted_data, item.iv)
    scan = scan_file(item.filename, decrypted)

    if not scan["safe"]:
        await db.delete(item)
        await db.commit()
        return {**scan, "auto_deleted": True, "message": "Threat detected — file auto-deleted from vault"}

    return {**scan, "auto_deleted": False, "message": "File is clean"}

@router.delete("/delete/{item_id}")
async def delete_file(item_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    result = await db.execute(select(VaultItem).where(VaultItem.id == item_id, VaultItem.user_id == current_user.id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="File not found")
    await db.delete(item)
    await db.commit()
    return {"message": "File deleted"}