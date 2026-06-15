import face_recognition
import numpy as np

def get_face_encoding(image):
    encodings = face_recognition.face_encodings(image)
    if len(encodings) == 0:
        return None
    return encodings[0]

def compare_faces(known_encoding, new_encoding):
    return face_recognition.compare_faces(
        [known_encoding],
        new_encoding,
        tolerance=0.5
    )[0]