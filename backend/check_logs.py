import requests

token = input('Paste your login token: ')
r = requests.get('http://localhost:8000/admin/logs?limit=10',
    headers={'Authorization': f'Bearer {token}'})
logs = r.json()
for l in logs:
    print(f"IP: {l['ip']} | Type: {l['attack_type']} | Country: {l['country']} | Lat: {l['latitude']} | Lon: {l['longitude']}")
