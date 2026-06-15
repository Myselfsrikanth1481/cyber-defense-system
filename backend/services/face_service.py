from services.face_auth import get_face_encoding, compare_faces
import numpy as np
import json

def process_face_registration(image):
    encoding = get_face_encoding(image)
    if encoding is None:
        return None
    return json.dumps(encoding.tolist()).encode()

def verify_user_face(stored_encoding, image):
    known = np.array(json.loads(stored_encoding.decode()))
    new_encoding = get_face_encoding(image)
    if new_encoding is None:
        return False
    return compare_faces(known, new_encoding)
