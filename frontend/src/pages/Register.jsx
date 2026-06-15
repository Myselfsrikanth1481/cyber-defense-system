import { useState, useRef } from "react";

const BASE_URL = "http://localhost:8000";

export default function Register({ onSwitch }) {
  const [role, setRole] = useState(null);
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState(null);
  const [faceFile, setFaceFile] = useState(null);
  const [faceCaptured, setFaceCaptured] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [captured, setCaptured] = useState(false);

  // ── Invite-code specific state ──
  const [inviteCode, setInviteCode] = useState("");
  const [inviteVerified, setInviteVerified] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // ── Verify invite code ──
  async function handleVerifyCode(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/admin-invite/verify-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: inviteCode.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Invalid code");
      setInviteName(data.name);
      setInviteEmail(data.email);
      setInvitePhone(data.phone);
      setInviteVerified(true);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  }

  // ── Complete invite registration ──
  async function handleInviteRegister(e) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/admin-invite/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: inviteCode.trim().toUpperCase(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Registration failed");
      setToken(data.temp_token);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  }

  // ── Normal user register ──
  async function handleRegister(e) {
    e.preventDefault();
    setError(""); setInfo("");
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Registration failed");
      if (data.resume) setInfo("Welcome back! It looks like you didn't complete Face ID setup last time. Let's finish it now.");
      setToken(data.temp_token);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  }

  // ── Camera helpers ──
  async function startCamera() {
    setCameraActive(true); setCaptured(false); setFaceFile(null); setError("");
    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        setError("Camera access denied. Please allow camera permissions.");
        setCameraActive(false);
      }
    }, 100);
  }

  function stopCamera() {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }

  function capturePhoto() {
    const canvas = canvasRef.current, video = videoRef.current;
    if (!canvas || !video) return;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      setFaceFile(new File([blob], "face.jpg", { type: "image/jpeg" }));
      setCaptured(true); stopCamera();
    }, "image/jpeg");
  }

  function retakePhoto() { setFaceFile(null); setCaptured(false); startCamera(); }

  async function submitFace() {
    if (!faceFile) { setError("Please capture a photo first"); return; }
    setLoading(true); setError("");
    try {
      const formData = new FormData();
      formData.append("file", faceFile);
      const res = await fetch(`${BASE_URL}/auth/register-face`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Face registration failed");
      setFaceCaptured(true);
      setTimeout(() => setStep(3), 800);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  }

  async function cancelRegistration() {
    setLoading(true); stopCamera();
    try {
      await fetch(`${BASE_URL}/auth/cancel-registration`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
    } catch (_) {}
    finally { setLoading(false); }
    setStep(1); setRole(null); setUsername(""); setEmail("");
    setPassword(""); setConfirm(""); setToken(null);
    setFaceFile(null); setFaceCaptured(false); setCaptured(false); setInfo("");
    setInviteCode(""); setInviteVerified(false); setInviteName(""); setInviteEmail(""); setInvitePhone("");
    setTimeout(() => setError("Face ID is required. Please register again to complete setup."), 100);
  }

  // ── Role Selection ──
  if (!role) return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.badge}>CREATE ACCOUNT</div>
        <h1 style={s.title}>Register</h1>
        <p style={s.sub}>Select your account type</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button style={{ ...s.roleBtn, borderColor: "#00ff88", color: "#00ff88" }}
            onClick={() => setRole("invite")}>
            <span style={{ fontSize: 20 }}>🛡</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Admin (Invite Code)</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>I have a code from super admin</div>
            </div>
          </button>
          <button style={{ ...s.roleBtn, borderColor: "#00aaff", color: "#00aaff" }}
            onClick={() => setRole("user")}>
            <span style={{ fontSize: 20 }}>👤</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>User</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>Personal dashboard + file sharing</div>
            </div>
          </button>
        </div>
        <p style={s.switchText}>Already registered? <span style={s.link} onClick={onSwitch}>Login here</span></p>
      </div>
    </div>
  );

  // ── Done ──
  if (step === 3) return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ ...s.badge, background: "rgba(0,255,136,0.15)", color: "#00ff88" }}>✅ REGISTERED</div>
        <h2 style={{ color: "#e8eaf0", margin: "16px 0 8px", fontSize: 20 }}>Account Activated!</h2>
        <p style={{ color: "#4a6070", fontSize: 13, marginBottom: 16 }}>
          ✅ Face ID registered. Login now requires face + password.
        </p>
        <button style={s.btn} onClick={onSwitch}>Go to Login →</button>
      </div>
    </div>
  );

  // ── Face Setup ──
  if (step === 2) return (
    <div style={s.page}>
      <div style={{ ...s.card, maxWidth: 460 }}>
        <div style={s.badge}>🛡 FACE ID SETUP</div>
        <h1 style={s.title}>Register Face ID</h1>
        <p style={s.sub}>Look directly at the camera and click Capture.</p>

        {info && (
          <div style={s.infoBanner}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>ℹ️</span>
            <span>{info}</span>
          </div>
        )}

        <div style={s.cameraBox}>
          {cameraActive && (
            <video ref={videoRef} autoPlay playsInline
              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
          )}
          {captured && faceFile && !cameraActive && (
            <img src={URL.createObjectURL(faceFile)} alt="Captured face"
              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
          )}
          {!cameraActive && !captured && (
            <div style={s.cameraIdle}>
              <div style={{ fontSize: 48, marginBottom: 10 }}>📷</div>
              <div style={{ color: "#4a6070", fontSize: 13 }}>Camera preview will appear here</div>
            </div>
          )}
          {cameraActive && <div style={s.faceGuide} />}
          <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>

        {captured && (
          <div style={{ color: "#00ff88", fontSize: 12, marginTop: 8, textAlign: "center" }}>
            ✅ Photo captured successfully!
          </div>
        )}

        {error && <div style={s.error}>{error}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
          {!cameraActive && !captured && (
            <button style={s.btn} onClick={startCamera}>📷 Open Camera</button>
          )}
          {cameraActive && (
            <div style={{ display: "flex", gap: 8 }}>
              <button style={s.btn} onClick={capturePhoto}>📸 Capture Photo</button>
              <button style={{ ...s.btn, background: "transparent", color: "#6b8090", border: "1px solid #1e3040" }}
                onClick={stopCamera}>Cancel</button>
            </div>
          )}
          {captured && !cameraActive && (
            <>
              <button style={s.btn} onClick={submitFace} disabled={loading}>
                {loading ? "Registering..." : "Register Face ID →"}
              </button>
              <button style={{ ...s.btn, background: "transparent", color: "#00aaff", border: "1px solid rgba(0,170,255,0.3)" }}
                onClick={retakePhoto} disabled={loading}>
                🔄 Retake Photo
              </button>
            </>
          )}
          <button
            style={{ ...s.btn, background: "transparent", color: "#ff6060", border: "1px solid rgba(255,60,60,0.3)" }}
            onClick={cancelRegistration} disabled={loading}>
            {loading ? "Cancelling..." : "Cancel Registration"}
          </button>
        </div>

        <p style={{ color: "#4a6070", fontSize: 11, textAlign: "center", marginTop: 10 }}>
          ⚠️ Face ID is required. Cancelling deletes your account.
        </p>
      </div>
    </div>
  );

  // ── Invite Code Flow ──
  if (role === "invite") return (
    <div style={s.page}>
      <div style={s.card}>
        <button style={s.backBtn}
          onClick={() => { setRole(null); setError(""); setInviteVerified(false); setInviteCode(""); }}>
          ← Change Role
        </button>
        <div style={{ ...s.badge, background: "rgba(0,255,136,0.1)", color: "#00ff88" }}>
          🛡 ADMIN REGISTRATION
        </div>
        <h1 style={s.title}>{inviteVerified ? "Set Your Password" : "Enter Invite Code"}</h1>

        {error && <div style={s.error}>{error}</div>}

        {/* Step A — Enter code */}
        {!inviteVerified && (
          <form onSubmit={handleVerifyCode}
            style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
            <div>
              <label style={s.label}>Invite Code</label>
              <input
                style={{ ...s.input, textTransform: "uppercase", letterSpacing: "0.2em", fontSize: 16, textAlign: "center" }}
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value.toUpperCase())}
                placeholder="e.g. AX7K29BQ"
                maxLength={8}
                required
              />
              <p style={{ color: "#4a6070", fontSize: 11, marginTop: 6 }}>
                Enter the code sent to your phone by the super admin.
              </p>
            </div>
            <button type="submit" style={s.btn} disabled={loading}>
              {loading ? "Verifying..." : "Verify Code →"}
            </button>
          </form>
        )}

        {/* Step B — Pre-filled details + set password */}
        {inviteVerified && (
          <form onSubmit={handleInviteRegister}
            style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
            <div>
              <label style={s.label}>Full Name</label>
              <div style={s.lockedValue}>🔒 {inviteName}</div>
            </div>
            <div>
              <label style={s.label}>Email Address</label>
              <div style={s.lockedValue}>🔒 {inviteEmail}</div>
            </div>
            <div>
              <label style={s.label}>Phone</label>
              <div style={s.lockedValue}>🔒 {invitePhone}</div>
            </div>
            <div>
              <label style={s.label}>Set Password</label>
              <input type="password" style={s.input} value={password}
                onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" required />
            </div>
            <div>
              <label style={s.label}>Confirm Password</label>
              <input type="password" style={s.input} value={confirm}
                onChange={e => setConfirm(e.target.value)} placeholder="••••••••" required />
            </div>
            <button type="submit" style={s.btn} disabled={loading}>
              {loading ? "Creating Account..." : "Continue to Face ID →"}
            </button>
          </form>
        )}

        <p style={s.switchText}>Already registered? <span style={s.link} onClick={onSwitch}>Login here</span></p>
      </div>
    </div>
  );

  // ── Regular User Credentials Form ──
  return (
    <div style={s.page}>
      <div style={s.card}>
        <button style={s.backBtn} onClick={() => { setRole(null); setError(""); }}>
          ← Change Role
        </button>
        <div style={{ ...s.badge, background: "rgba(0,170,255,0.1)", color: "#00aaff" }}>
          👤 USER REGISTRATION
        </div>
        <h1 style={s.title}>Create Account</h1>
        {error && <div style={s.error}>{error}</div>}
        <form onSubmit={handleRegister}
          style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
          <div>
            <label style={s.label}>Username</label>
            <input style={s.input} value={username}
              onChange={e => setUsername(e.target.value)} placeholder="your_username" required />
          </div>
          <div>
            <label style={s.label}>Email Address</label>
            <input type="email" style={s.input} value={email}
              onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required />
          </div>
          <div>
            <label style={s.label}>Password</label>
            <input type="password" style={s.input} value={password}
              onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <div>
            <label style={s.label}>Confirm Password</label>
            <input type="password" style={s.input} value={confirm}
              onChange={e => setConfirm(e.target.value)} placeholder="••••••••" required />
          </div>
          <button type="submit" style={s.btn} disabled={loading}>
            {loading ? "Checking..." : "Create Account →"}
          </button>
        </form>
        <p style={s.switchText}>Already registered? <span style={s.link} onClick={onSwitch}>Login here</span></p>
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", background: "#080c10", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Exo 2', sans-serif" },
  card: { background: "#0d1117", border: "1px solid #1e3a2f", borderRadius: 12, padding: "44px 40px", width: "100%", maxWidth: 420, boxShadow: "0 0 40px rgba(0,255,136,0.05)" },
  badge: { display: "inline-block", background: "rgba(0,255,136,0.1)", color: "#00ff88", fontSize: 10, fontWeight: 700, letterSpacing: ".15em", padding: "3px 10px", borderRadius: 4, marginBottom: 18, border: "1px solid rgba(0,255,136,0.2)" },
  title: { color: "#e8eaf0", fontSize: 20, fontWeight: 700, margin: "0 0 4px" },
  sub: { color: "#4a6070", fontSize: 11, margin: "0 0 20px", lineHeight: 1.5 },
  label: { color: "#6b8090", fontSize: 11, fontWeight: 600, letterSpacing: ".05em", display: "block", marginBottom: 5 },
  input: { background: "#111820", border: "1px solid #1e3040", borderRadius: 6, padding: "9px 12px", color: "#e8eaf0", fontSize: 13, outline: "none", fontFamily: "'Share Tech Mono', monospace", width: "100%", boxSizing: "border-box" },
  error: { background: "rgba(255,60,60,0.1)", border: "1px solid rgba(255,60,60,0.3)", borderRadius: 6, padding: "9px 12px", color: "#ff6060", fontSize: 12, marginTop: 8 },
  infoBanner: { background: "rgba(0,170,255,0.08)", border: "1px solid rgba(0,170,255,0.25)", borderRadius: 6, padding: "9px 12px", color: "#00aaff", fontSize: 12, marginBottom: 12, display: "flex", gap: 8, alignItems: "flex-start", lineHeight: 1.5 },
  btn: { background: "#00ff88", color: "#080c10", border: "none", borderRadius: 6, padding: 11, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Exo 2', sans-serif", width: "100%" },
  backBtn: { background: "none", border: "none", color: "#4a6070", cursor: "pointer", fontSize: 12, marginBottom: 12, padding: 0 },
  roleBtn: { display: "flex", alignItems: "center", gap: 14, background: "transparent", border: "1px solid", borderRadius: 8, padding: "14px 16px", cursor: "pointer", fontFamily: "'Exo 2', sans-serif", textAlign: "left", width: "100%" },
  switchText: { color: "#4a6070", fontSize: 12, textAlign: "center", marginTop: 18 },
  link: { color: "#00ff88", cursor: "pointer", textDecoration: "underline" },
  lockedValue: { background: "#0a1520", border: "1px solid #1e3040", borderRadius: 6, padding: "9px 12px", color: "#4a6070", fontSize: 13, fontFamily: "'Share Tech Mono', monospace" },
  cameraBox: { position: "relative", width: "100%", height: 220, background: "#111820", border: "1px solid #1e3040", borderRadius: 8, overflow: "hidden", marginTop: 4 },
  cameraIdle: { width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" },
  faceGuide: { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 140, height: 170, border: "2px dashed rgba(0,255,136,0.5)", borderRadius: "50%", pointerEvents: "none" },
};