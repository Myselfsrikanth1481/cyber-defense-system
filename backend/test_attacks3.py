import requests

BASE = 'http://localhost:8000'
headers = {'X-Forwarded-For': '45.33.32.160'}

print('Starting attack tests...')

# SQL Injection - via query string
try:
    r = requests.get(BASE + '/admin/logs?q=union+select+*+from+users', headers=headers, timeout=5)
    print(f'SQL Injection -> {r.status_code}: {r.text[:100]}')
except Exception as e:
    print(f'SQL Injection -> Error: {e}')

# XSS - via query string
try:
    r = requests.get(BASE + '/admin/logs?q=<script>alert(1)</script>', headers=headers, timeout=5)
    print(f'XSS -> {r.status_code}: {r.text[:100]}')
except Exception as e:
    print(f'XSS -> Error: {e}')

# Command Injection
try:
    r = requests.get(BASE + '/admin/logs?cmd=;+rm+-rf+/', headers=headers, timeout=5)
    print(f'Command Injection -> {r.status_code}: {r.text[:100]}')
except Exception as e:
    print(f'Command Injection -> Error: {e}')

# Path Traversal
try:
    r = requests.get(BASE + '/../../../etc/passwd', headers=headers, timeout=5)
    print(f'Path Traversal -> {r.status_code}: {r.text[:100]}')
except Exception as e:
    print(f'Path Traversal -> Error: {e}')

# Brute Force login
print('Testing Brute Force...')
for i in range(12):
    try:
        r = requests.post(BASE + '/auth/login', headers=headers,
            data={'username': 'admin', 'password': f'wrongpass{i}'},
            timeout=5)
        print(f'  Attempt {i+1} -> {r.status_code}: {r.json().get("detail","")}')
    except Exception as e:
        print(f'  Attempt {i+1} -> Error: {e}')

print('Done.')
