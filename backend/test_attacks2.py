import requests

BASE = 'http://localhost:8000'
headers = {'X-Forwarded-For': '45.33.32.158'}

tests = [
    ('SQL Injection', 'POST', '/vault/upload', {'data': {'query': 'union select * from users'}}),
    ('SQL Injection 2', 'POST', '/vault/upload', {'data': {'q': '1=1 OR drop table users'}}),
    ('XSS Attack', 'POST', '/vault/upload', {'data': {'input': '<script>alert(1)</script>'}}),
    ('XSS Attack 2', 'POST', '/vault/upload', {'data': {'x': 'onerror=alert(document.cookie)'}}),
    ('Command Injection', 'POST', '/vault/upload', {'data': {'cmd': '; rm -rf /'}}),
    ('Path Traversal', 'GET', '/../../../etc/passwd', {}),
]

for name, method, path, kwargs in tests:
    try:
        kwargs['headers'] = headers
        r = getattr(requests, method.lower())(BASE + path, **kwargs)
        detail = r.json().get('detail', '')
        print(f'{name} -> {r.status_code}: {detail}')
    except Exception as e:
        print(f'{name} -> Error: {e}')
