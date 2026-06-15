content = open('routers/auth.py', 'r', encoding='utf-8').read()

if '/logout' not in content:
    logout_code = '''

@router.post("/logout")
async def logout_user(request: Request, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    ip = request.client.host
    geo = await get_ip_geo(ip)
    try:
        log = LoginLog(
            user_id=current_user.id,
            username=current_user.username,
            role=current_user.role,
            ip=ip,
            city=geo.get("city"),
            country=geo.get("country"),
            status="logout",
        )
        db.add(log)
        await db.commit()
        print(f"[LOGOUT] {current_user.username}")
    except Exception as e:
        print(f"Logout log error: {e}")
    return {"message": "Logged out successfully"}
'''
    content = content + logout_code
    open('routers/auth.py', 'w', encoding='utf-8').write(content)
    print('Logout endpoint added!')
else:
    print('Logout endpoint already exists!')
