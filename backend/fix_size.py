import os, re

for root, dirs, files in os.walk('routers'):
    for f in files:
        if f.endswith('.py'):
            path = os.path.join(root, f)
            content = open(path, 'r', encoding='utf-8').read()
            if '50' in content and ('MB' in content or '1024' in content or 'size' in content.lower()):
                content = content.replace('50 * 1024 * 1024', '1024 * 1024 * 1024')
                content = content.replace('52428800', '1073741824')
                content = content.replace('50MB', '1GB')
                open(path, 'w', encoding='utf-8').write(content)
                print(f'Fixed: {path}')

# Also update main.py for FastAPI body size limit
main = open('app/main.py', 'r', encoding='utf-8').read()
if 'max_upload_size' not in main and 'body_limit' not in main:
    print('No upload size limit found in main.py - backend default is unlimited')
else:
    main = main.replace('50 * 1024 * 1024', '1024 * 1024 * 1024')
    main = main.replace('52428800', '1073741824')
    open('app/main.py', 'w', encoding='utf-8').write(main)
    print('Backend limit updated!')

print('Done!')
