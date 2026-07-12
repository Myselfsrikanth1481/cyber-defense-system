import os

path = r"C:\Users\srika\OneDrive\Desktop\project's\cyber-defense-system-FIXED\cyber-defense-fixed\backend\blockchain\web3_client.py"
content = open(path, 'r', encoding='utf-8').read()

new_content = '''try:
    from web3 import Web3
    WEB3_AVAILABLE = True
except ImportError:
    Web3 = None
    WEB3_AVAILABLE = False

''' + content.replace('from web3 import Web3', '').replace('from web3 import Web3\n', '')

open(path, 'w', encoding='utf-8').write(new_content)
print('web3_client.py updated with optional import!')
