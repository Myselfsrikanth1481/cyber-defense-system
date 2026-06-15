from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey
from sqlalchemy.sql import func
from database import Base

class AdminInvite(Base):
    __tablename__ = "admin_invites"

    id           = Column(Integer, primary_key=True, index=True)
    name         = Column(String, nullable=False)
    email        = Column(String, unique=True, nullable=False)
    phone        = Column(String, nullable=False)
    invite_code  = Column(String, unique=True, nullable=False)
    approved     = Column(Boolean, default=False)
    used         = Column(Boolean, default=False)
    created_by   = Column(Integer, nullable=False)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    approved_at  = Column(DateTime(timezone=True), nullable=True)
    expires_at   = Column(DateTime(timezone=True), nullable=True)
    used_at      = Column(DateTime(timezone=True), nullable=True)
    