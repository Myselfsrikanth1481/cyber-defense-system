from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from database import Base

class DocTransaction(Base):
    __tablename__ = "doc_transactions"

    id                = Column(Integer, primary_key=True, index=True)
    doc_id            = Column(Integer, nullable=False)
    filename          = Column(String, nullable=False)
    file_size         = Column(Integer, default=0)
    message_preview   = Column(String, nullable=True)

    sender_id         = Column(Integer, nullable=False)
    sender_username   = Column(String, nullable=False)
    sender_role       = Column(String, nullable=False)

    receiver_id       = Column(Integer, nullable=False)
    receiver_username = Column(String, nullable=False)
    receiver_role     = Column(String, nullable=False)

    tx_hash           = Column(String, nullable=True)
    block_number      = Column(Integer, nullable=True)
    chain_mode        = Column(String, nullable=True)

    sent_at           = Column(DateTime(timezone=True), server_default=func.now())