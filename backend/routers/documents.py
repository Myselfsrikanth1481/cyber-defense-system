from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc, or_, and_, func
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from datetime import datetime
from typing import Optional
import json
import os

from database import get_db
from models.user import User
from models.shared_document import SharedDocument
from models.doc_transaction import DocTransaction
from app.dependencies import get_current_user
from services.scanner import scan_file
from blockchain.web3_client import store_doc_transaction

router = APIRouter(prefix="/documents", tags=["documents"])

MAX_FILE_SIZE = 1024 * 1024 * 1024  # 1GB

_AES_KEY = os.environ.get("DOC_AES_KEY", "").encode().ljust(32, b"\x00")[:32]
if _AES_KEY == b"\x00" * 32:
    _AES_KEY = os.urandom(32)

def _encrypt(data: bytes):
    iv = os.urandom(12)
    return AESGCM(_AES_KEY).encrypt(iv, data, None), iv

def _decrypt(data: bytes, iv: bytes):
    return AESGCM(_AES_KEY).decrypt(iv, data, None)

def _block_if_threat(scan: dict, context: str = "File"):
    if not scan["safe"]:
        raise HTTPException(
            status_code=422,
            detail={
                "blocked": True,
                "reason": f"{context} blocked by AI security scan — threat detected.",
                "threat_level": scan["threat_level"],
                "threat_score": scan["threat_score"],
                "threats": scan["threats"],
                "details": scan["details"],
                "entropy": scan["entropy"],
                "file_size": scan["file_size"],
            }
        )


# ── Helper: record blockchain transaction ─────────────────────────────────────

async def _record_tx(db: AsyncSession, doc: SharedDocument,
                     sender: User, receiver: User):
    """Write a DocTransaction record + blockchain entry for every send."""
    chain = store_doc_transaction(
        sender=sender.username,
        receiver=receiver.username,
        filename=doc.filename,
        doc_id=doc.id,
    )
    tx = DocTransaction(
        doc_id=doc.id,
        filename=doc.filename if doc.filename != "_text_only_" else "(message only)",
        file_size=doc.file_size,
        message_preview=(doc.message or "")[:80],
        sender_id=sender.id,
        sender_username=sender.username,
        sender_role=sender.role,
        receiver_id=receiver.id,
        receiver_username=receiver.username,
        receiver_role=receiver.role,
        tx_hash=chain.get("tx_hash"),
        block_number=chain.get("block_number"),
        chain_mode=chain.get("mode"),
    )
    db.add(tx)
    await db.commit()


# ── Blockchain ledger ──────────────────────────────────────────────────────────

@router.get("/blockchain-ledger")
async def get_blockchain_ledger(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Visibility rules:
      super_admin  → sees ALL transactions
      admin        → sees transactions where they are sender or receiver,
                     PLUS all user↔user transactions
      user         → sees only transactions where they are sender or receiver
    """
    result = await db.execute(
        select(DocTransaction).order_by(desc(DocTransaction.sent_at))
    )
    all_txs = result.scalars().all()

    visible = []
    for tx in all_txs:
        is_participant = (
            tx.sender_id == current_user.id or
            tx.receiver_id == current_user.id
        )
        is_user_to_user = (
            tx.sender_role == "user" and tx.receiver_role == "user"
        )

        if current_user.role == "super_admin":
            visible.append(tx)
        elif current_user.role == "admin":
            if is_participant or is_user_to_user:
                visible.append(tx)
        else:
            # regular user
            if is_participant:
                visible.append(tx)

    return [
        {
            "id": t.id,
            "doc_id": t.doc_id,
            "filename": t.filename,
            "file_size": t.file_size,
            "message_preview": t.message_preview,
            "sender_id": t.sender_id,
            "sender_username": t.sender_username,
            "sender_role": t.sender_role,
            "receiver_id": t.receiver_id,
            "receiver_username": t.receiver_username,
            "receiver_role": t.receiver_role,
            "tx_hash": t.tx_hash,
            "block_number": t.block_number,
            "chain_mode": t.chain_mode,
            "sent_at": str(t.sent_at),
        }
        for t in visible
    ]


# ── Contact list ───────────────────────────────────────────────────────────────

@router.get("/admins")
async def get_admins(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Not authorized")
    result = await db.execute(
        select(User).where(
            and_(User.role.in_(["admin", "super_admin"]), User.id != current_user.id)
        )
    )
    contacts = result.scalars().all()
    return [
        {"id": c.id, "username": c.username, "email": c.email, "role": c.role}
        for c in contacts
    ]


@router.get("/contacts")
async def get_contacts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Not authorized")

    result = await db.execute(
        select(User).where(
            and_(User.role.in_(["admin", "super_admin"]), User.id != current_user.id)
        )
    )
    contacts = result.scalars().all()

    contact_list = []
    for c in contacts:
        unread_result = await db.execute(
            select(func.count(SharedDocument.id)).where(
                SharedDocument.sender_id == c.id,
                SharedDocument.receiver_id == current_user.id,
                SharedDocument.is_read == False,
            )
        )
        unread = unread_result.scalar() or 0

        last_msg_result = await db.execute(
            select(SharedDocument).where(
                or_(
                    and_(SharedDocument.sender_id == current_user.id,
                         SharedDocument.receiver_id == c.id),
                    and_(SharedDocument.sender_id == c.id,
                         SharedDocument.receiver_id == current_user.id),
                )
            ).order_by(desc(SharedDocument.sent_at)).limit(1)
        )
        last_msg = last_msg_result.scalar_one_or_none()

        contact_list.append({
            "id": c.id,
            "username": c.username,
            "email": c.email,
            "role": c.role,
            "unread": unread,
            "last_message": last_msg.message if last_msg else None,
            "last_filename": last_msg.filename if last_msg and last_msg.filename != "_text_only_" else None,
            "last_at": str(last_msg.sent_at) if last_msg else None,
        })

    contact_list.sort(key=lambda x: x["last_at"] or "", reverse=True)
    return contact_list


# ── Unread total ───────────────────────────────────────────────────────────────

@router.get("/unread-total")
async def get_total_unread(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(func.count(SharedDocument.id)).where(
            SharedDocument.receiver_id == current_user.id,
            SharedDocument.is_read == False,
        )
    )
    return {"unread": result.scalar() or 0}


# ── Conversation thread ────────────────────────────────────────────────────────

@router.get("/conversation/{user_id}")
async def get_conversation(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SharedDocument).where(
            or_(
                and_(SharedDocument.sender_id == current_user.id,
                     SharedDocument.receiver_id == user_id),
                and_(SharedDocument.sender_id == user_id,
                     SharedDocument.receiver_id == current_user.id),
            )
        ).order_by(SharedDocument.sent_at.asc())
    )
    messages = result.scalars().all()

    now = datetime.utcnow()
    for msg in messages:
        if msg.receiver_id == current_user.id and not msg.is_read:
            msg.is_read = True
            msg.read_at = now
    await db.commit()

    return [
        {
            "id": m.id,
            "sender_id": m.sender_id,
            "sender_username": m.sender_username,
            "receiver_id": m.receiver_id,
            "receiver_username": m.receiver_username,
            "message": m.message,
            "filename": m.filename if m.filename != "_text_only_" else None,
            "file_size": m.file_size,
            "is_read": m.is_read,
            "read_at": str(m.read_at) if m.read_at else None,
            "sent_at": str(m.sent_at),
        }
        for m in messages
    ]


# ── Send ───────────────────────────────────────────────────────────────────────

@router.post("/send")
async def send_document(
    receiver_id: Optional[int] = Form(None),
    receiver_username: Optional[str] = Form(None),
    message: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Only admins can send documents")

    if not message and not file:
        raise HTTPException(status_code=400, detail="Must provide a message or file")

    if receiver_id:
        result = await db.execute(select(User).where(User.id == receiver_id))
    elif receiver_username:
        result = await db.execute(select(User).where(User.username == receiver_username))
    else:
        raise HTTPException(status_code=400, detail="Provide receiver_id or receiver_username")

    receiver = result.scalar_one_or_none()
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver not found")
    if receiver.role not in ("super_admin", "admin"):
        raise HTTPException(status_code=400, detail="Can only send to admins or super admin")
    if receiver.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot send to yourself")

    encrypted_data = b""
    iv = b""
    filename = "_text_only_"
    file_size = 0

    if file:
        raw = await file.read()
        if len(raw) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large. Max 1GB.")
        scan = scan_file(file.filename, raw)
        _block_if_threat(scan, context="File sharing")
        encrypted_data, iv = _encrypt(raw)
        filename = file.filename
        file_size = len(raw)

    doc = SharedDocument(
        sender_id=current_user.id,
        sender_username=current_user.username,
        receiver_id=receiver.id,
        receiver_username=receiver.username,
        filename=filename,
        encrypted_data=encrypted_data,
        iv=iv,
        file_size=file_size,
        message=message or "",
        is_read=False,
    )
    db.add(doc)
    await db.flush()  # get doc.id before commit

    # ── Record blockchain transaction ──
    await _record_tx(db, doc, sender=current_user, receiver=receiver)

    return {"message": "Sent successfully", "id": doc.id}


# ── Broadcast ──────────────────────────────────────────────────────────────────

@router.post("/broadcast")
async def broadcast_message(
    receiver_ids: str = Form(...),
    message: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Only admins can broadcast")

    if not message and not file:
        raise HTTPException(status_code=400, detail="Must provide a message or file")

    try:
        ids = json.loads(receiver_ids)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid receiver_ids format")

    encrypted_data = b""
    iv = b""
    filename = "_text_only_"
    file_size = 0

    if file:
        raw = await file.read()
        if len(raw) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail="File too large. Max 1GB.")
        scan = scan_file(file.filename, raw)
        _block_if_threat(scan, context="Broadcast file")
        encrypted_data, iv = _encrypt(raw)
        filename = file.filename
        file_size = len(raw)

    sent = []
    for rid in ids:
        result = await db.execute(select(User).where(User.id == rid))
        receiver = result.scalar_one_or_none()
        if not receiver or receiver.role not in ("admin", "super_admin") or receiver.id == current_user.id:
            continue
        doc = SharedDocument(
            sender_id=current_user.id,
            sender_username=current_user.username,
            receiver_id=rid,
            receiver_username=receiver.username,
            filename=filename,
            encrypted_data=encrypted_data,
            iv=iv,
            file_size=file_size,
            message=message or "",
            is_read=False,
        )
        db.add(doc)
        await db.flush()

        # ── Record blockchain transaction per recipient ──
        await _record_tx(db, doc, sender=current_user, receiver=receiver)
        sent.append(receiver.username)

    return {"message": f"Broadcast sent to {len(sent)} recipients", "recipients": sent}


# ── Inbox ──────────────────────────────────────────────────────────────────────

@router.get("/inbox")
async def get_inbox(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Not authorized")

    result = await db.execute(
        select(SharedDocument)
        .where(SharedDocument.receiver_id == current_user.id)
        .order_by(desc(SharedDocument.sent_at))
    )
    docs = result.scalars().all()
    return [
        {
            "id": d.id,
            "sender_id": d.sender_id,
            "sender_username": d.sender_username,
            "filename": d.filename if d.filename != "_text_only_" else None,
            "file_size": d.file_size,
            "message": d.message,
            "is_read": d.is_read,
            "sent_at": str(d.sent_at),
        }
        for d in docs
    ]


# ── Sent ───────────────────────────────────────────────────────────────────────

@router.get("/sent")
async def get_sent(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Not authorized")

    result = await db.execute(
        select(SharedDocument)
        .where(SharedDocument.sender_id == current_user.id)
        .order_by(desc(SharedDocument.sent_at))
    )
    docs = result.scalars().all()
    return [
        {
            "id": d.id,
            "receiver_id": d.receiver_id,
            "receiver_username": d.receiver_username,
            "filename": d.filename if d.filename != "_text_only_" else None,
            "file_size": d.file_size,
            "message": d.message,
            "is_read": d.is_read,
            "sent_at": str(d.sent_at),
        }
        for d in docs
    ]


# ── Download ───────────────────────────────────────────────────────────────────

@router.get("/download/{doc_id}")
async def download_document(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SharedDocument).where(SharedDocument.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.sender_id != current_user.id and doc.receiver_id != current_user.id:
        if current_user.role not in ("super_admin", "admin"):
            raise HTTPException(status_code=403, detail="Not authorized")
    if not doc.encrypted_data or doc.filename == "_text_only_":
        raise HTTPException(status_code=400, detail="No file attached")

    if doc.receiver_id == current_user.id and not doc.is_read:
        doc.is_read = True
        doc.read_at = datetime.utcnow()
        await db.commit()

    decrypted = _decrypt(doc.encrypted_data, doc.iv)
    scan = scan_file(doc.filename, decrypted)
    if not scan["safe"]:
        await db.delete(doc)
        await db.commit()
        raise HTTPException(
            status_code=422,
            detail={
                "blocked": True,
                "reason": "File blocked on download — threat detected. File permanently deleted.",
                "threat_level": scan["threat_level"],
                "threat_score": scan["threat_score"],
                "threats": scan["threats"],
                "details": scan["details"],
                "entropy": scan["entropy"],
                "file_size": scan["file_size"],
                "auto_deleted": True,
            }
        )

    return Response(
        content=decrypted,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{doc.filename}"'},
    )


# ── Mark read ──────────────────────────────────────────────────────────────────

@router.patch("/read/{doc_id}")
async def mark_as_read(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SharedDocument).where(SharedDocument.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.receiver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    doc.is_read = True
    doc.read_at = datetime.utcnow()
    await db.commit()
    return {"message": "Marked as read"}


# ── Delete ─────────────────────────────────────────────────────────────────────

@router.delete("/delete/{doc_id}")
async def delete_document(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SharedDocument).where(SharedDocument.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.sender_id != current_user.id and doc.receiver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    await db.delete(doc)
    await db.commit()
    return {"message": "Document deleted"}