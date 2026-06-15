import re
content = open('src/pages/Vault.jsx', 'r', encoding='utf-8').read()
content = content.replace('max 50MB', 'max 1GB')
content = content.replace('50MB', '1GB')
content = content.replace('50 * 1024 * 1024', '1024 * 1024 * 1024')
content = content.replace('52428800', '1073741824')
open('src/pages/Vault.jsx', 'w', encoding='utf-8').write(content)
print('Frontend limit updated to 1GB!')
