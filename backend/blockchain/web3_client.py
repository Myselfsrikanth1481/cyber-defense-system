try:
    from web3 import Web3
    WEB3_AVAILABLE = True
except ImportError:
    Web3 = None
    WEB3_AVAILABLE = False
import json, os
from app.config import settings

w3 = None
contract = None

def init_web3():
    global w3, contract
    try:
        w3 = Web3(Web3.HTTPProvider(settings.WEB3_PROVIDER))
        if w3.is_connected() and settings.CONTRACT_ADDRESS and os.path.exists(settings.ABI_PATH):
            with open(settings.ABI_PATH) as f:
                abi = json.load(f)
            contract = w3.eth.contract(address=settings.CONTRACT_ADDRESS, abi=abi)
            print("Blockchain connected")
        else:
            print("Blockchain: running in mock mode (Ganache not connected)")
    except Exception as e:
        print(f"Blockchain init error: {e}")

def store_log_on_chain(ip: str, attack_type: str, confidence: float) -> dict:
    """Store intrusion log as blockchain transaction. Returns tx_hash and block_number."""
    if not w3 or not contract:
        import hashlib, random
        mock_hash = "0x" + hashlib.sha256(f"{ip}{attack_type}{confidence}".encode()).hexdigest()
        return {"tx_hash": mock_hash, "block_number": random.randint(1000, 9999), "mode": "mock"}
    try:
        account = w3.eth.accounts[0]
        tx = contract.functions.storeLog(ip, attack_type, int(confidence * 100)).transact({"from": account})
        receipt = w3.eth.wait_for_transaction_receipt(tx)
        return {"tx_hash": receipt.transactionHash.hex(), "block_number": receipt.blockNumber, "mode": "live"}
    except Exception as e:
        print(f"Chain store error: {e}")
        return {"tx_hash": None, "block_number": None, "mode": "error"}

def get_all_logs_from_chain() -> list:
    """Read all stored logs from blockchain."""
    if not contract:
        return []
    try:
        logs = contract.functions.getAllLogs().call()
        return [{"ip": l[0], "attack_type": l[1], "confidence": l[2] / 100, "timestamp": l[3]} for l in logs]
    except:
        return []

init_web3()
def store_doc_transaction(sender: str, receiver: str, filename: str, doc_id: int) -> dict:
    """Store document share event on blockchain. Returns tx_hash and block_number."""
    if not w3 or not contract:
        import hashlib, random
        mock_hash = "0x" + hashlib.sha256(
            f"{sender}{receiver}{filename}{doc_id}".encode()
        ).hexdigest()
        return {
            "tx_hash": mock_hash,
            "block_number": random.randint(10000, 99999),
            "mode": "mock"
        }
    try:
        account = w3.eth.accounts[0]
        tx = contract.functions.storeLog(
            f"{sender}->{receiver}", filename, doc_id
        ).transact({"from": account})
        receipt = w3.eth.wait_for_transaction_receipt(tx)
        return {
            "tx_hash": receipt.transactionHash.hex(),
            "block_number": receipt.blockNumber,
            "mode": "live"
        }
    except Exception as e:
        import hashlib, random
        print(f"Chain doc store error: {e}")
        mock_hash = "0x" + hashlib.sha256(
            f"{sender}{receiver}{filename}{doc_id}".encode()
        ).hexdigest()
        return {
            "tx_hash": mock_hash,
            "block_number": random.randint(10000, 99999),
            "mode": "mock"
        }