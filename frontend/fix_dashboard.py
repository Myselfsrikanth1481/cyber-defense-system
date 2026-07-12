content = open('src/pages/SuperAdminDashboard.jsx', 'r', encoding='utf-8').read()
content = content.replace('http://localhost:8000', 'https://excusable-agile-mourner.ngrok-free.dev')
open('src/pages/SuperAdminDashboard.jsx', 'w', encoding='utf-8').write(content)
print('SuperAdminDashboard updated!')
