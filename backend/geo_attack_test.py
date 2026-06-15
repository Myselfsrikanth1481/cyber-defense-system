import requests
import time

BASE = 'http://localhost:8000'

# Use real public IPs from different countries
attacks = [
    ('8.8.8.8', 'USA - Google'),
    ('1.1.1.1', 'Australia - Cloudflare'),
    ('185.220.101.1', 'Germany - Tor Exit'),
    ('45.33.32.156', 'USA - Linode'),
    ('104.21.0.1', 'USA - Cloudflare'),
    ('91.108.4.1', 'Netherlands - Telegram'),
    ('103.21.244.1', 'Singapore'),
]

for ip, label in attacks:
    headers = {'X-Forwarded-For': ip}
    print(f'\nAttacking from {label} ({ip})')

    # Port scan
    for path in ['/wp-admin', '/phpmyadmin', '/.env', '/admin', '/shell']:
        try:
            r = requests.get(BASE + path, headers=headers, timeout=5)
            print(f'  {path} -> {r.status_code}')
        except Exception as e:
            print(f'  Error: {e}')
        time.sleep(0.2)

    # Brute force
    for i in range(3):
        try:
            r = requests.post(BASE + '/auth/login', headers=headers,
                data={'username': 'admin', 'password': f'wrong{i}'}, timeout=5)
            print(f'  Login attempt {i+1} -> {r.status_code}')
        except Exception as e:
            print(f'  Error: {e}')
        time.sleep(0.2)

print('\nDone! Check your SOC dashboard.')
