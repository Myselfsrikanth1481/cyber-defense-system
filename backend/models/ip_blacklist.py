from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.sql import func
from database import Base

class IPBlacklist(Base):
    __tablename__ = "ip_blacklist"
    id = Column(Integer, primary_key=True, index=True)
    ip = Column(String, unique=True, index=True, nullable=False)
    reason = Column(String, default="manual")
    blocked_by = Column(String, default="admin")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)
    active = Column(Boolean, default=True)
