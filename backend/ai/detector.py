import joblib
import os

# Load model safely
MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")

try:
    model = joblib.load(MODEL_PATH)
except Exception as e:
    print("🔥 Model loading error:", str(e))
    model = None


def detect_anomaly(features):
    try:
        if not model:
            return False

        prediction = model.predict([features])
        
        # 🔍 DEBUG
        print(f"[AI] Features: {features}")
        print(f"[AI] Prediction: {prediction[0]}")

        # 🚨 Anomaly condition
        if prediction[0] == -1:
            print("🚨 AI ANOMALY DETECTED")
            return True

        return False

    except Exception as e:
        print("🔥 AI detection error:", str(e))
        return False