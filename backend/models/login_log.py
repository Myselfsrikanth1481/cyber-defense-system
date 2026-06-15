from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from database import Base

class LoginLog(Base):
    __tablename__ = "login_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    username = Column(String, nullable=False)
    role = Column(String, nullable=True)
    ip = Column(String, nullable=False)
    country = Column(String, nullable=True)
    city = Column(String, nullable=True)
    status = Column(String, default="success")
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
