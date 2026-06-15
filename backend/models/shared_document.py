from sqlalchemy import Column, Integer, String, DateTime, LargeBinary, Boolean, ForeignKey, Text
from sqlalchemy.sql import func
from database import Base

class SharedDocument(Base):
    __tablename__ = "shared_documents"

    id                = Column(Integer, primary_key=True, index=True)
    sender_id         = Column(Integer, ForeignKey("users.id"), nullable=False)
    sender_username   = Column(String, nullable=False)
    receiver_id       = Column(Integer, ForeignKey("users.id"), nullable=False)
    receiver_username = Column(String, nullable=False)
    filename          = Column(String, nullable=False)
    file_size         = Column(Integer, default=0)
    encrypted_data    = Column(LargeBinary, nullable=False)
    iv                = Column(LargeBinary, nullable=False)
    message           = Column(Text, nullable=True)
    is_read           = Column(Boolean, default=False)
    read_at           = Column(DateTime(timezone=True), nullable=True)
    sent_at           = Column(DateTime(timezone=True), server_default=func.now())