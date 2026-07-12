import { useState, useRef } from "react";
import { loginUser } from "../api";

export default function Login({ onSwitch, saveToken }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState("login");
  const [tempToken, setTempToken] = useState("");
  const [faceFile, setFaceFile] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [captured, setCaptured] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await loginUser(username, password);
      console.log("LOGIN RESPONSE:", JSON.stringify(data)); // ← debug line
      if (data.status === "success" && data.access_token) {
        saveToken(data.access_token);
        window.location.reload();
      } else if (data.status === "face_required" && data.temp_token) {
        setTempToken(data.temp_token);
        setStep("face");
        setTimeout(() => startCamera(), 200);
      } else if (data.access_token) {
        saveToken(data.access_token);
        window.location.reload();
      } else {
        setError("Unexpected response from server");
      }
    } catch (err) {
      console.log("LOGIN ERROR:", err.message); // ← debug line
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleFaceVerify = async () => {
    if (!faceFile) { setError("Please capture your face first"); return; }
    setError("");
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", faceFile);
      const res = await fetch("https://cyber-defense-system-1422.onrender.com/auth/verify-face", {
        method: "POST",
        headers: { Authorization: `Bearer ${tempToken}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Face verification failed");
      saveToken(data.access_token);
      window.location.reload();
    } catch (err) {
      setError(err.message || "Face verification failed");
    } finally {
      setLoading(false);
    }
  };

  async function startCamera() {
    setCameraActive(true);
    setCaptured(false);
    setFaceFile(null);
    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        setError("Camera access denied. Please allow camera permission.");
        setCameraActive(false);
      }
    }, 100);
  }

  function stopCamera() {
    if (videoRef.current?.srcObject)
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
    setCameraActive(false);
  }

  function capturePhoto() {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      setFaceFile(new File([blob], "face.jpg", { type: "image/jpeg" }));
      setCaptured(true);
      stopCamera();
    }, "image/jpeg");
  }

  function retake() {
    setFaceFile(null);
    setCaptured(false);
    setError("");
    startCamera();
  }

  return (
    <div style={s.page}>
      <div style={s.bgGrid} />
      <div style={s.card}>
        <div style={s.logoRow}>
          <div style={s.logoIcon}>🛡️</div>
          <div>
            <div style={s.logoTitle}>CYBER DEFENSE</div>
            <div style={s.logoSub}>SYSTEM v3.0</div>
          </div>
        </div>

        <div style={s.divider} />

        <div style={s.badge}>
          {step === "login" ? "🔐 SECURE LOGIN" : "👁️ FACE VERIFICATION"}
        </div>

        <p style={s.sub}>
          {step === "login"
            ? "Enter your credentials to access the system"
            : "Look directly at the camera and capture your face"}
        </p>

        {error && (
          <div style={s.error}>
            <span style={{ marginRight: 8 }}>⚠️</span>{error}
          </div>
        )}

        {step === "login" ? (
          <form onSubmit={handleLogin} style={s.form}>
            <div style={s.fieldWrap}>
              <label style={s.label}>USERNAME</label>
              <div style={s.inputWrap}>
                <span style={s.inputIcon}>👤</span>
                <input
                  style={s.input}
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>
            <div style={s.fieldWrap}>
              <label style={s.label}>PASSWORD</label>
              <div style={s.inputWrap}>
                <span style={s.inputIcon}>🔑</span>
                <input
                  style={s.input}
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <button style={s.btn} type="submit" disabled={loading}>
              {loading ? "⏳ Authenticating..." : "🔓 Sign In →"}
            </button>
          </form>

        ) : (
          <div style={s.form}>
            {cameraActive && (
              <div>
                <div style={{ position: "relative" }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    style={{ width: "100%", borderRadius: 10, border: "2px solid #00ff88", background: "#000", display: "block" }}
                  />
                  <div style={{
                    position: "absolute", top: "50%", left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: 140, height: 170,
                    border: "2px dashed rgba(0,255,136,0.5)",
                    borderRadius: "50%",
                    pointerEvents: "none",
                  }} />
                </div>
                <canvas ref={canvasRef} style={{ display: "none" }} />
                <p style={{ color: "#4a6070", fontSize: 11, textAlign: "center", margin: "8px 0" }}>
                  Position your face inside the guide and click capture
                </p>
                <button style={s.btn} onClick={capturePhoto}>
                  📸 Capture Face
                </button>
              </div>
            )}

            {captured && !cameraActive && faceFile && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.2)", borderRadius: 10, padding: "16px", textAlign: "center" }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
                  <div style={{ color: "#00ff88", fontSize: 14, fontWeight: 700 }}>Face Captured!</div>
                  <div style={{ color: "#4a6070", fontSize: 11, marginTop: 4 }}>Ready for verification</div>
                </div>
                <button
                  style={{ ...s.btn, background: "rgba(0,170,255,0.1)", color: "#00aaff", border: "1px solid rgba(0,170,255,0.3)" }}
                  onClick={retake}
                >
                  🔄 Retake Photo
                </button>
              </div>
            )}

            {!cameraActive && !captured && (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📷</div>
                <button style={s.btn} onClick={startCamera}>
                  Start Camera →
                </button>
              </div>
            )}

            <button
              style={{ ...s.btn, marginTop: 8, opacity: (!faceFile || loading) ? 0.5 : 1 }}
              onClick={handleFaceVerify}
              disabled={loading || !faceFile}
            >
              {loading ? "⏳ Verifying..." : "👁️ Verify Face ID →"}
            </button>

            <button
              style={{ ...s.btn, background: "transparent", color: "#6b8090", border: "1px solid #1e3040" }}
              onClick={() => { setStep("login"); setError(""); setFaceFile(null); setCaptured(false); stopCamera(); }}
            >
              ← Back to Login
            </button>
          </div>
        )}

        <div style={s.divider} />

        <p style={s.switchText}>
          Don't have an account?{" "}
          <span style={s.link} onClick={onSwitch}>Register here</span>
        </p>

        <div style={s.secureNote}>
          🔒 256-bit encrypted · Face ID protected · Blockchain logged
        </div>
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    background: "#080c10",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Exo 2', sans-serif",
    position: "relative",
    overflow: "hidden",
  },
  bgGrid: {
    position: "fixed",
    inset: 0,
    backgroundImage: "linear-gradient(rgba(0,255,136,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.03) 1px, transparent 1px)",
    backgroundSize: "40px 40px",
    pointerEvents: "none",
  },
  card: {
    background: "#0d1117",
    border: "1px solid #1e3a2f",
    borderRadius: 16,
    padding: "40px 44px",
    width: "100%",
    maxWidth: 440,
    boxShadow: "0 0 60px rgba(0,255,136,0.06), 0 0 120px rgba(0,255,136,0.02)",
    position: "relative",
    zIndex: 1,
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
  },
  logoIcon: {
    fontSize: 36,
    filter: "drop-shadow(0 0 8px rgba(0,255,136,0.4))",
  },
  logoTitle: {
    color: "#e8eaf0",
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: "0.12em",
    lineHeight: 1,
  },
  logoSub: {
    color: "#00ff88",
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.2em",
    marginTop: 3,
  },
  divider: {
    height: 1,
    background: "linear-gradient(90deg, transparent, #1e3a2f, transparent)",
    margin: "16px 0",
  },
  badge: {
    display: "inline-block",
    background: "rgba(0,255,136,0.08)",
    color: "#00ff88",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: ".12em",
    padding: "4px 12px",
    borderRadius: 4,
    marginBottom: 10,
    border: "1px solid rgba(0,255,136,0.2)",
  },
  sub: {
    color: "#4a6070",
    fontSize: 12,
    margin: "0 0 20px",
    lineHeight: 1.6,
  },
  error: {
    background: "rgba(255,60,60,0.08)",
    border: "1px solid rgba(255,60,60,0.3)",
    borderRadius: 8,
    padding: "10px 14px",
    color: "#ff6060",
    fontSize: 12,
    marginBottom: 16,
    display: "flex",
    alignItems: "center",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  fieldWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    color: "#4a6070",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.12em",
  },
  inputWrap: {
    display: "flex",
    alignItems: "center",
    background: "#111820",
    border: "1px solid #1e3040",
    borderRadius: 8,
    overflow: "hidden",
  },
  inputIcon: {
    padding: "0 12px",
    fontSize: 14,
    borderRight: "1px solid #1e3040",
  },
  input: {
    flex: 1,
    background: "transparent",
    border: "none",
    padding: "11px 14px",
    color: "#e8eaf0",
    fontSize: 13,
    outline: "none",
    fontFamily: "'Share Tech Mono', monospace",
    width: "100%",
  },
  btn: {
    background: "linear-gradient(135deg, #00ff88, #00cc6a)",
    color: "#080c10",
    border: "none",
    borderRadius: 8,
    padding: "12px 16px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "'Exo 2', sans-serif",
    width: "100%",
    letterSpacing: "0.05em",
  },
  switchText: {
    color: "#4a6070",
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
  },
  link: {
    color: "#00ff88",
    cursor: "pointer",
    textDecoration: "underline",
    fontWeight: 600,
  },
  secureNote: {
    color: "#2a4030",
    fontSize: 10,
    textAlign: "center",
    marginTop: 14,
    letterSpacing: "0.05em",
  },
};