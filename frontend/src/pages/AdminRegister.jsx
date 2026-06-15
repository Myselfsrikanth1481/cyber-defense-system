import { useState, useRef } from "react";

const BASE_URL = "http://localhost:8000";

const STEPS = ["code", "password", "face", "done"];

export default function AdminRegister() {
  const [step, setStep] = useState("code");
  const [code, setCode] = useState("");
  const [inviteData, setInviteData] = useState(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tempToken, setTempToken] = useState(null);
  const [faceFile, setFaceFile] = useState(null);
  const fileRef = useRef();

  // ── Step 1: Verify Code ──
  async function handleVerifyCode() {
    if (!code.trim()) return setError("Please enter your registration code");
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${BASE_URL}/admin-invite/verify-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Invalid code");
      setInviteData(data);
      setStep("password");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: Set Password ──
  async function handleSetPassword() {
    if (!password || password.length < 8)
      return setError("Password must be at least 8 characters");
    if (password !== confirmPassword)
      return setError("Passwords do not match");
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${BASE_URL}/admin-invite/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim().toUpperCase(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to set password");
      setTempToken(data.temp_token);
      setStep("face");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Step 3: Face Scan ──
  async function handleFaceScan() {
    if (!faceFile) return setError("Please select a photo of your face");
    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", faceFile);
      const res = await fetch(`${BASE_URL}/auth/register-face`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tempToken}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Face registration failed");
      setStep("done");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSkipFace() {
    setStep("done");
  }

  const stepIndex = STEPS.indexOf(step);

  return (
    <div style={s.shell}>
      <div style={s.card}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.logo}>🛡️</div>
          <div style={s.title}>Admin Registration</div>
          <div style={s.subtitle}>Cyber Defense System — Secure Admin Onboarding</div>
        </div>

        {/* Progress Bar */}
        <div style={s.progressWrap}>
          {["Enter Code", "Set Password", "Face Scan", "Complete"].map((label, i) => (
            <div key={label} style={s.progressItem}>
              <div style={{
                ...s.progressDot,
                background: i < stepIndex ? "#00ff88" : i === stepIndex ? "#0d1117" : "#1e3040",
                border: i === stepIndex ? "2px solid #00ff88" : i < stepIndex ? "2px solid #00ff88" : "2px solid #1e3040",
                boxShadow: i === stepIndex ? "0 0 10px rgba(0,255,136,0.4)" : "none",
                color: i < stepIndex ? "#080c10" : "#e8eaf0",
              }}>
                {i < stepIndex ? "✓" : i + 1}
              </div>
              <div style={{ ...s.progressLabel, color: i <= stepIndex ? "#00ff88" : "#4a6070" }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Error */}
        {error && <div style={s.error}>⚠️ {error}</div>}

        {/* ── Step 1: Code Entry ── */}
        {step === "code" && (
          <div style={s.stepWrap}>
            <div style={s.stepTitle}>Enter Your Registration Code</div>
            <div style={s.stepDesc}>
              Your code was sent via SMS after the super admin approved your invite.
            </div>
            <input
              style={{ ...s.input, textAlign: "center", fontSize: 20, letterSpacing: "0.3em" }}
              placeholder="A3F9B2C1"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && handleVerifyCode()}
              maxLength={8}
            />
            <button style={s.btn} onClick={handleVerifyCode} disabled={loading}>
              {loading ? "⏳ Verifying..." : "Verify Code →"}
            </button>
          </div>
        )}

        {/* ── Step 2: Pre-filled Info + Password ── */}
        {step === "password" && inviteData && (
          <div style={s.stepWrap}>
            <div style={s.stepTitle}>Your Details</div>
            <div style={s.infoBox}>
              <div style={s.infoRow}>
                <span style={s.infoLabel}>Name</span>
                <span style={s.infoValue}>{inviteData.name}</span>
              </div>
              <div style={s.infoRow}>
                <span style={s.infoLabel}>Email</span>
                <span style={s.infoValue}>{inviteData.email}</span>
              </div>
              <div style={s.infoRow}>
                <span style={s.infoLabel}>Phone</span>
                <span style={s.infoValue}>{inviteData.phone}</span>
              </div>
              <div style={{ ...s.infoRow, border: "none" }}>
                <span style={s.infoLabel}>Role</span>
                <span style={{ ...s.infoValue, color: "#00ff88", fontWeight: 700 }}>ADMIN</span>
              </div>
            </div>
            <div style={s.stepTitle}>Set Your Password</div>
            <input
              style={s.input}
              type="password"
              placeholder="Password (min 8 characters)"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <input
              style={{ ...s.input, marginTop: 10 }}
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSetPassword()}
            />
            <button style={s.btn} onClick={handleSetPassword} disabled={loading}>
              {loading ? "⏳ Setting password..." : "Set Password →"}
            </button>
          </div>
        )}

        {/* ── Step 3: Face Scan ── */}
        {step === "face" && (
          <div style={s.stepWrap}>
            <div style={s.stepTitle}>Face Scan Enrollment</div>
            <div style={s.stepDesc}>
              Upload a clear frontal photo. Your face will be used for secure login authentication.
            </div>
            <div style={s.faceBox}>
              <div style={{ fontSize: 60, marginBottom: 12 }}>📷</div>
              {faceFile ? (
                <div style={{ marginBottom: 16 }}>
                  <img
                    src={URL.createObjectURL(faceFile)}
                    alt="face preview"
                    style={{ width: 120, height: 120, borderRadius: "50%", objectFit: "cover", border: "2px solid #00ff88" }}
                  />
                  <div style={{ color: "#00ff88", fontSize: 12, marginTop: 8 }}>✅ {faceFile.name}</div>
                </div>
              ) : (
                <div style={{ color: "#6b8090", fontSize: 13, marginBottom: 16 }}>
                  Select a clear frontal photo of your face
                </div>
              )}

              <label style={s.fileLabel}>
                {faceFile ? "📁 Change Photo" : "📁 Choose Photo"}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={e => { setFaceFile(e.target.files[0]); setError(""); }}
                />
              </label>
            </div>

            <button style={s.btn} onClick={handleFaceScan} disabled={loading || !faceFile}>
              {loading ? "⏳ Registering face..." : "📷 Register Face →"}
            </button>
            <button
              style={{ ...s.btn, background: "transparent", color: "#4a6070", border: "1px solid #1e3040", marginTop: 4 }}
              onClick={handleSkipFace}
            >
              Skip for now (set up at login)
            </button>
          </div>
        )}

        {/* ── Step 4: Done ── */}
        {step === "done" && (
          <div style={s.stepWrap}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 60, marginBottom: 16 }}>🎉</div>
              <div style={s.stepTitle}>Account Activated!</div>
              <div style={s.stepDesc}>
                Your admin account is ready. You can now log in to the Cyber Defense System.
              </div>
              <div style={{
                background: "rgba(0,255,136,0.05)",
                border: "1px solid rgba(0,255,136,0.2)",
                borderRadius: 10,
                padding: "16px 20px",
                marginTop: 20,
                marginBottom: 20,
              }}>
                <div style={{ color: "#00ff88", fontSize: 13, fontWeight: 700 }}>✅ Account Created</div>
                <div style={{ color: "#6b8090", fontSize: 12, marginTop: 4 }}>Role: Admin</div>
                <div style={{ color: "#6b8090", fontSize: 12 }}>Email: {inviteData?.email}</div>
                <div style={{ color: "#6b8090", fontSize: 12 }}>
                  Face ID: {faceFile ? "✅ Enrolled" : "⚠️ Not enrolled (set up at login)"}
                </div>
              </div>
              <button style={s.btn} onClick={() => window.location.href = "/"}>
                Go to Login →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  shell: {
    minHeight: "100vh",
    background: "#060a0f",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Exo 2', sans-serif",
    padding: "20px",
  },
  card: {
    background: "#0d1117",
    border: "1px solid #1e3040",
    borderRadius: 16,
    padding: "40px",
    width: "100%",
    maxWidth: 480,
  },
  header: { textAlign: "center", marginBottom: 32 },
  logo: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: 700, color: "#e8eaf0", marginBottom: 6 },
  subtitle: { fontSize: 12, color: "#4a6070" },
  progressWrap: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 32,
    position: "relative",
  },
  progressItem: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 },
  progressDot: {
    width: 32, height: 32,
    borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 12, fontWeight: 700,
    transition: "all 0.3s",
  },
  progressLabel: { fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textAlign: "center" },
  error: {
    background: "rgba(255,68,68,0.1)",
    border: "1px solid rgba(255,68,68,0.3)",
    borderRadius: 8,
    padding: "10px 14px",
    color: "#ff6060",
    fontSize: 13,
    marginBottom: 16,
  },
  stepWrap: { display: "flex", flexDirection: "column", gap: 12 },
  stepTitle: { fontSize: 15, fontWeight: 700, color: "#e8eaf0", marginBottom: 4 },
  stepDesc: { fontSize: 13, color: "#6b8090", marginBottom: 8 },
  input: {
    background: "#080c10",
    border: "1px solid #1e3040",
    borderRadius: 8,
    padding: "12px 16px",
    color: "#e8eaf0",
    fontSize: 14,
    outline: "none",
    fontFamily: "monospace",
    letterSpacing: "0.1em",
    width: "100%",
    boxSizing: "border-box",
  },
  btn: {
    background: "#00ff88",
    color: "#080c10",
    border: "none",
    borderRadius: 8,
    padding: "12px 20px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "'Exo 2', sans-serif",
    width: "100%",
    marginTop: 8,
  },
  infoBox: {
    background: "#080c10",
    border: "1px solid #1e3040",
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 16,
  },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    borderBottom: "1px solid #1e3040",
  },
  infoLabel: { color: "#4a6070", fontSize: 12, fontWeight: 600 },
  infoValue: { color: "#e8eaf0", fontSize: 13, fontFamily: "monospace" },
  faceBox: {
    background: "#080c10",
    border: "1px solid #1e3040",
    borderRadius: 10,
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
  },
  fileLabel: {
    background: "rgba(0,255,136,0.1)",
    color: "#00ff88",
    border: "1px solid rgba(0,255,136,0.3)",
    borderRadius: 8,
    padding: "10px 20px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "'Exo 2', sans-serif",
  },
};