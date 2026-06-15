import requests

token = input('Paste your login token: ')
r = requests.get('http://localhost:8000/admin/attack-map',
    headers={'Authorization': f'Bearer {token}'})
print('Status:', r.status_code)
print('Data:', r.json())
