import numpy as np
from sklearn.ensemble import IsolationForest
import joblib
import os

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")

np.random.seed(42)

data = []

# Normal traffic (800 samples) - CICIDS BENIGN
for _ in range(800):
    data.append([
        np.random.randint(1, 5),
        np.random.randint(5, 30),
        np.random.randint(0, 2),
        0,
        0,
        0,
        np.random.randint(0, 2),
        0,
        1,
        1,
    ])

# DDoS attack (100 samples) - CICIDS DDoS
for _ in range(100):
    data.append([
        np.random.randint(400, 600),
        np.random.randint(1, 10),
        0,
        1,
        np.random.randint(0, 2),
        0,
        0,
        1,
        0,
        0,
    ])

# Port scan (100 samples) - CICIDS PortScan
for _ in range(100):
    data.append([
        np.random.randint(10, 50),
        np.random.randint(20, 80),
        np.random.randint(0, 2),
        1,
        0,
        1,
        np.random.randint(0, 2),
        1,
        0,
        0,
    ])

# Web attacks (100 samples) - CICIDS WebAttacks
for _ in range(100):
    data.append([
        np.random.randint(5, 20),
        np.random.randint(50, 200),
        1,
        np.random.randint(0, 2),
        0,
        1,
        1,
        np.random.randint(0, 2),
        np.random.randint(0, 2),
        0,
    ])

# Bot traffic (100 samples) - CICIDS Bot
for _ in range(100):
    data.append([
        np.random.randint(20, 100),
        np.random.randint(5, 40),
        np.random.randint(0, 2),
        1,
        0,
        np.random.randint(0, 2),
        0,
        1,
        0,
        0,
    ])

print(f"Total training samples: {len(data)}")
print(f"   Normal traffic : 800 samples (CICIDS BENIGN)")
print(f"   DDoS attacks   : 100 samples (CICIDS DDoS)")
print(f"   Port scans     : 100 samples (CICIDS PortScan)")
print(f"   Web attacks    : 100 samples (CICIDS WebAttacks)")
print(f"   Bot traffic    : 100 samples (CICIDS Bot)")

model = IsolationForest(
    n_estimators=200,
    contamination=0.33,
    max_samples="auto",
    random_state=42,
)
model.fit(data)

joblib.dump(model, MODEL_PATH)
print(f"Model trained and saved: {MODEL_PATH}")
print(f"Features : 10 (matches features.py exactly)")
print(f"Algorithm: IsolationForest (n_estimators=200)")
print(f"Dataset  : CICIDS-inspired synthetic data")
