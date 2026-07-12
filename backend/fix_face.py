content = open('routers/auth.py', 'r', encoding='utf-8').read()

old = '''    try:
        import face_recognition
        import io
        from PIL import Image
        contents = await file.read()
        img = np.array(Image.open(io.BytesIO(contents)).convert("RGB"))
        known = np.array(json.loads(current_user.face_encoding.decode()))
        unknown_encodings = face_recognition.face_encodings(img)
        if not unknown_encodings:
            raise HTTPException(status_code=400, detail="No face detected in photo")
        match = face_recognition.compare_faces([known], unknown_encodings[0], tolerance=0.5)[0]
        if not match:
            raise HTTPException(status_code=401, detail="Face verification failed - not a match")
        return {
            "verified": True,
            "access_token": create_token(current_user.username, current_user.role),
            "token_type": "bearer",
            "role": current_user.role,
        }
    except Exception as e:
        print(f"FACE ERROR: {e}")
        raise HTTPException(status_code=501, detail=f"Face recognition error: {str(e)}")'''

new = '''    try:
        import face_recognition
        import io
        from PIL import Image
        contents = await file.read()
        print(f"[FACE] File size: {len(contents)} bytes")
        if len(contents) == 0:
            raise HTTPException(status_code=400, detail="Empty image received — camera capture failed")
        img = np.array(Image.open(io.BytesIO(contents)).convert("RGB"))
        print(f"[FACE] Image shape: {img.shape}")
        known = np.array(json.loads(current_user.face_encoding.decode()))
        unknown_encodings = face_recognition.face_encodings(img)
        print(f"[FACE] Faces found in image: {len(unknown_encodings)}")
        if not unknown_encodings:
            raise HTTPException(status_code=400, detail="No face detected in photo — please ensure good lighting and face the camera directly")
        match = face_recognition.compare_faces([known], unknown_encodings[0], tolerance=0.6)[0]
        distance = face_recognition.face_distance([known], unknown_encodings[0])[0]
        print(f"[FACE] Match: {match}, Distance: {distance:.3f}")
        if not match:
            raise HTTPException(status_code=401, detail=f"Face verification failed — not a match (distance: {distance:.2f})")
        return {
            "verified": True,
            "access_token": create_token(current_user.username, current_user.role),
            "token_type": "bearer",
            "role": current_user.role,
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"FACE ERROR: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=501, detail=f"Face recognition error: {str(e)}")'''

content = content.replace(old, new)
open('routers/auth.py', 'w', encoding='utf-8').write(content)
print('verify-face updated with better logging!')
