from sqlalchemy import Column, Integer, String, DateTime, Boolean, LargeBinary
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String, nullable=False)
    face_encoding = Column(LargeBinary, nullable=True)
    role = Column(String, default="user")
    is_admin = Column(Boolean, default=False)
    is_blocked = Column(Boolean, default=False)
    blocked_reason = Column(String, nullable=True)
    blocked_at = Column(DateTime(timezone=True), nullable=True)
    otp_code = Column(String, nullable=True)
    otp_expiry = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)
    last_login_ip = Column(String, nullable=True)
    phone = Column(String, nullable=True)
