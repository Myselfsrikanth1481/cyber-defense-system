from sqlalchemy import Column, Integer, String, DateTime, LargeBinary, ForeignKey
from sqlalchemy.sql import func
from database import Base

class VaultItem(Base):
    __tablename__ = "vault_items"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename = Column(String, nullable=False)
    encrypted_data = Column(LargeBinary, nullable=False)
    iv = Column(LargeBinary, nullable=False)
    size = Column(Integer, default=0)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
