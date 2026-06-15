import requests

BASE = 'http://localhost:8000'
headers = {'X-Forwarded-For': '45.33.32.157'}

paths = ['/wp-admin', '/phpmyadmin', '/.env', '/admin', '/shell', '/backdoor']

for i in range(8):
    for path in paths:
        try:
            r = requests.get(BASE + path, headers=headers)
            detail = r.json().get('detail', '')
            print(f'Round {i+1} | {path} -> {r.status_code}: {detail}')
        except Exception as e:
            print(f'Error: {e}')
