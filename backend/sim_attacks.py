import urllib.request, json, time

BASE = 'http://localhost:8000'
print('Simulating attacks...')

attacks = [
    ('SQLMap', {'username': "' UNION SELECT * FROM users--", 'password': 'x'}, 'sqlmap/1.7.8'),
    ('XSS', {'username': '<script>alert(1)</script>', 'password': 'x'}, 'Mozilla/5.0'),
    ('Brute1', {'username': 'admin', 'password': 'password123'}, 'Mozilla/5.0'),
    ('Brute2', {'username': 'admin', 'password': 'admin123'}, 'Mozilla/5.0'),
    ('Brute3', {'username': 'admin', 'password': '123456'}, 'Mozilla/5.0'),
]

for name, payload, ua in attacks:
    try:
        data = json.dumps(payload).encode()
        req = urllib.request.Request(f'{BASE}/auth/login', data=data, headers={'Content-Type': 'application/json', 'User-Agent': ua})
        urllib.request.urlopen(req)
    except Exception as e:
        print(f'  {name}: blocked ({e.code if hasattr(e, "code") else e})')
    time.sleep(0.3)

print('Simulating port scans...')
for path in ['/wp-admin', '/phpmyadmin', '/.env', '/shell', '/backdoor', '/cmd']:
    try:
        req = urllib.request.Request(f'{BASE}{path}', headers={'User-Agent': 'nikto/2.1.6'})
        urllib.request.urlopen(req)
    except: pass
    time.sleep(0.1)

print('All done! Refresh your dashboard.')
