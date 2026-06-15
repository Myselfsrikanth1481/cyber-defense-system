from sqlalchemy import Column, Integer, String, DateTime, Boolean, Float
from sqlalchemy.sql import func
from database import Base

class SecurityLog(Base):
    __tablename__ = "security_logs"
    id = Column(Integer, primary_key=True, index=True)
    ip = Column(String, nullable=False, index=True)
    attack_type = Column(String, nullable=False)
    confidence = Column(Float, default=0.0)
    country = Column(String, nullable=True)
    city = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    isp = Column(String, nullable=True)
    blocked = Column(Boolean, default=True)
    tx_hash = Column(String, nullable=True)
    block_number = Column(Integer, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
