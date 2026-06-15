import { useEffect, useState } from "react";
import { getVaultItems, downloadVaultFile, deleteVaultItem } from "../api";
import FileUploader from "../components/FileUploader";

function formatSize(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(name) {
  const ext = (name || "").split(".").pop().toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "🖼";
  if (["pdf"].includes(ext)) return "📄";
  if (["zip", "rar", "tar", "gz", "7z"].includes(ext)) return "📦";
  if (["doc", "docx"].includes(ext)) return "📝";
  if (["xls", "xlsx"].includes(ext)) return "📊";
  if (["mp4", "mov", "avi"].includes(ext)) return "🎬";
  if (["mp3", "wav"].includes(ext)) return "🎵";
  return "📁";
}

function ThreatBadge({ level }) {
  const colors = {
    CLEAN: { bg: "rgba(0,255,136,0.1)", color: "#00ff88", border: "rgba(0,255,136,0.3)" },
    LOW: { bg: "rgba(255,204,0,0.1)", color: "#ffcc00", border: "rgba(255,204,0,0.3)" },
    MEDIUM: { bg: "rgba(255,136,0,0.1)", color: "#ff8800", border: "rgba(255,136,0,0.3)" },
    HIGH: { bg: "rgba(255,68,68,0.1)", color: "#ff4444", border: "rgba(255,68,68,0.3)" },
    CRITICAL: { bg: "rgba(180,0,0,0.2)", color: "#ff0000", border: "rgba(255,0,0,0.5)" },
  };
  const c = colors[level] || colors.CLEAN;
  return (
    <span style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}`, fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 3, letterSpacing: "0.05em" }}>
      {level === "CLEAN" ? "✓ CLEAN" : `⚠ ${level}`}
    </span>
  );
}

function ScanResultModal({ result, onClose }) {
  if (!result) return null;
  const isBlocked = !result.safe;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "#0d1117", border: `1px solid ${isBlocked ? "#ff4444" : "#00ff88"}`, borderRadius: 12, padding: 28, width: 480, maxWidth: "90vw" }}>
        <div style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>{isBlocked ? "🚨" : "✅"}</div>
        <div style={{ color: isBlocked ? "#ff4444" : "#00ff88", fontSize: 16, fontWeight: 700, textAlign: "center", marginBottom: 16 }}>
          {isBlocked ? "THREAT DETECTED — FILE BLOCKED" : "FILE IS CLEAN"}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Threat Level", value: result.threat_level },
            { label: "Threat Score", value: `${result.threat_score}/100` },
            { label: "Entropy", value: `${result.entropy}/8.0` },
            { label: "File Size", value: formatSize(result.file_size) },
          ].map(s => (
            <div key={s.label} style={{ background: "#080c10", borderRadius: 6, padding: "10px 12px", border: "1px solid #1e3040" }}>
              <div style={{ color: "#4a6070", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 4 }}>{s.label.toUpperCase()}</div>
              <div style={{ color: "#e8eaf0", fontSize: 14, fontWeight: 700 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {result.threats && result.threats.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: "#6b8090", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 8 }}>THREATS DETECTED</div>
            {result.threats.map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "6px 0", borderBottom: "1px solid #0d1520" }}>
                <span style={{ color: "#ff4444", fontSize: 12 }}>●</span>
                <span style={{ color: "#c8cad0", fontSize: 12 }}>{t}</span>
              </div>
            ))}
          </div>
        )}

        {result.auto_deleted && (
          <div style={{ background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.3)", borderRadius: 6, padding: "10px 14px", marginBottom: 16, color: "#ff6060", fontSize: 12 }}>
            🗑 File has been automatically deleted from vault for your safety.
          </div>
        )}

        <div style={{ color: "#4a6070", fontSize: 10, marginBottom: 16, fontFamily: "monospace", background: "#080c10", padding: 10, borderRadius: 6 }}>
          {result.details}
        </div>

        <button onClick={onClose} style={{ width: "100%", background: isBlocked ? "rgba(255,68,68,0.15)" : "rgba(0,255,136,0.1)", color: isBlocked ? "#ff6060" : "#00ff88", border: `1px solid ${isBlocked ? "rgba(255,68,68,0.3)" : "rgba(0,255,136,0.3)"}`, borderRadius: 6, padding: "10px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
          Close
        </button>
      </div>
    </div>
  );
}

function ScanningOverlay({ filename }) {
  const [step, setStep] = useState(0);
  const steps = [
    "🔍 Analyzing file signature...",
    "🧬 Checking magic bytes...",
    "📊 Calculating entropy...",
    "🔎 Scanning for malware patterns...",
    "🛡 Running AI deep content scan...",
    "✅ Finalizing security report...",
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStep(prev => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "#0d1117", border: "1px solid #1e3040", borderRadius: 12, padding: 32, width: 420, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🛡️</div>
        <div style={{ color: "#00ff88", fontSize: 15, fontWeight: 700, marginBottom: 6 }}>AI Security Scan Running</div>
        <div style={{ color: "#4a6070", fontSize: 12, marginBottom: 24, fontFamily: "monospace" }}>{filename}</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, textAlign: "left" }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, opacity: i <= step ? 1 : 0.2, transition: "opacity 0.3s" }}>
              <span style={{ color: i < step ? "#00ff88" : i === step ? "#ffcc00" : "#4a6070", fontSize: 12 }}>
                {i < step ? "✓" : i === step ? "▶" : "○"}
              </span>
              <span style={{ color: i <= step ? "#c8cad0" : "#4a6070", fontSize: 12 }}>{s}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20, height: 4, background: "#1e3040", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${((step + 1) / steps.length) * 100}%`, background: "linear-gradient(90deg, #00ff88, #00aaff)", borderRadius: 2, transition: "width 0.4s" }} />
        </div>
      </div>
    </div>
  );
}

export default function Vault({ user, onLogout }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [scanning, setScanning] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [message, setMessage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadScanFile, setUploadScanFile] = useState(null);

  async function load() {
    try {
      const data = await getVaultItems();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function showMsg(text, ok = true) {
    setMessage({ text, ok });
    setTimeout(() => setMessage(null), 5000);
  }

  async function handleDelete(item) {
    setDeleting(item.id);
    try {
      await deleteVaultItem(item.id);
      showMsg(`🗑 Deleted ${item.filename}`);
      load();
    } catch (e) {
      showMsg(e.message, false);
    } finally { setDeleting(null); }
  }

  async function handleDownload(item) {
    setScanning(`Scanning ${item.filename} before download...`);
    try {
      await downloadVaultFile(item.id, item.filename);
      showMsg(`✅ ${item.filename} scanned clean and downloaded`);
    } catch (e) {
      const detail = e?.response?.data?.detail || e.message;
      if (typeof detail === "object" && detail.blocked) {
        setScanResult({
          safe: false,
          threat_level: detail.threat_level,
          threat_score: 100,
          threats: detail.threats,
          details: detail.reason,
          entropy: 0,
          file_size: 0,
          auto_deleted: true,
        });
      } else {
        showMsg(typeof detail === "string" ? detail : "Download blocked", false);
      }
    } finally {
      setScanning(null);
    }
  }

  async function handleManualScan(item) {
    setScanning(`Deep scanning ${item.filename}...`);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:8000/vault/scan/${item.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setScanResult(data);
      if (data.auto_deleted) load();
    } catch (e) {
      showMsg("Scan failed: " + e.message, false);
    } finally {
      setScanning(null);
    }
  }

  // Custom upload handler with scan feedback
  async function handleUpload(file) {
    setUploadScanFile(file.name);
    setUploading(true);
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("http://localhost:8000/vault/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = data.detail;
        if (typeof detail === "object" && detail.blocked) {
          setScanResult({
            safe: false,
            threat_level: detail.threat_level,
            threat_score: detail.threat_score,
            threats: detail.threats,
            details: detail.details || detail.reason,
            entropy: 0,
            file_size: 0,
            auto_deleted: false,
          });
        } else {
          showMsg(typeof detail === "string" ? detail : "Upload failed", false);
        }
      } else {
        setScanResult({
          safe: true,
          threat_level: data.scan?.status || "CLEAN",
          threat_score: data.scan?.threat_score || 0,
          threats: [],
          details: `File scanned clean and encrypted with AES-256. Entropy: ${data.scan?.entropy}/8.0`,
          entropy: data.scan?.entropy || 0,
          file_size: data.size,
          auto_deleted: false,
        });
        load();
      }
    } catch (e) {
      showMsg("Upload error: " + e.message, false);
    } finally {
      setUploading(false);
      setUploadScanFile(null);
    }
  }

  return (
    <div style={styles.shell}>
      {(scanning || (uploading && uploadScanFile)) && (
        <ScanningOverlay filename={scanning || uploadScanFile} />
      )}
      {scanResult && (
        <ScanResultModal result={scanResult} onClose={() => setScanResult(null)} />
      )}

      {/* Header */}
      <div style={styles.topbar}>
        <div>
          <div style={styles.pageTitle}>🔐 Private Vault</div>
          <div style={styles.pageSub}>AES-256 Encrypted · AI Security Scanning · {items.length} file{items.length !== 1 ? "s" : ""}</div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.2)", borderRadius: 6, padding: "4px 10px" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00ff88", display: "inline-block" }} />
            <span style={{ color: "#00ff88", fontSize: 10, fontWeight: 700 }}>AI SCAN ACTIVE</span>
          </div>
          <span style={styles.userChip}>{user?.username || "User"}</span>
          <button style={styles.logoutBtn} onClick={onLogout}>Logout</button>
        </div>
      </div>

      <div style={styles.body}>
        {/* Security Info Banner */}
        <div style={{ background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.15)", borderRadius: 10, padding: "14px 18px", display: "flex", gap: 16, flexWrap: "wrap" }}>
          {[
            { icon: "🔍", label: "Upload Scan", desc: "Every file scanned before storing" },
            { icon: "⬇️", label: "Download Scan", desc: "Re-verified before every download" },
            { icon: "📤", label: "Share Scan", desc: "Scanned before sharing to others" },
            { icon: "🗑", label: "Auto-Delete", desc: "Threats auto-removed instantly" },
          ].map(f => (
            <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 180 }}>
              <span style={{ fontSize: 20 }}>{f.icon}</span>
              <div>
                <div style={{ color: "#00ff88", fontSize: 11, fontWeight: 700 }}>{f.label}</div>
                <div style={{ color: "#4a6070", fontSize: 10 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Upload */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Upload File</div>
          <div style={{ background: "#0d1117", border: "2px dashed #1e3040", borderRadius: 10, padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🛡️</div>
            <div style={{ color: "#6b8090", fontSize: 12, marginBottom: 16 }}>
              Files are AI-scanned for malware before encryption
            </div>
            <input
              type="file"
              id="vault-upload"
              style={{ display: "none" }}
              onChange={(e) => e.target.files[0] && handleUpload(e.target.files[0])}
            />
            <label htmlFor="vault-upload" style={{ background: "rgba(0,255,136,0.1)", color: "#00ff88", border: "1px solid rgba(0,255,136,0.3)", borderRadius: 6, padding: "10px 24px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
              Choose File to Upload
            </label>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div style={{ ...styles.msg, color: message.ok ? "#00ff88" : "#ff4444", borderColor: message.ok ? "rgba(0,255,136,0.3)" : "rgba(255,68,68,0.3)" }}>
            {message.text}
          </div>
        )}

        {/* File list */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Your Files ({items.length})</div>
          {loading ? (
            <div style={styles.empty}>Loading vault...</div>
          ) : items.length === 0 ? (
            <div style={styles.empty}>
              <div style={styles.emptyIcon}>🔒</div>
              <div>Your vault is empty</div>
              <div style={{ fontSize: 12, color: "#4a5568", marginTop: 4 }}>Upload a file above to get started</div>
            </div>
          ) : (
            <div style={styles.fileGrid}>
              {items.map((item) => (
                <div key={item.id} style={styles.fileCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={styles.fileIcon}>{fileIcon(item.filename)}</div>
                    <ThreatBadge level="CLEAN" />
                  </div>
                  <div style={styles.fileName}>{item.filename}</div>
                  <div style={styles.fileMeta}>
                    <span>{formatSize(item.size)}</span>
                    <span>{item.uploaded_at ? new Date(item.uploaded_at).toLocaleDateString() : "—"}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span style={styles.encBadge}>AES-256</span>
                    <span style={{ background: "rgba(0,170,255,0.08)", color: "#00aaff", border: "1px solid rgba(0,170,255,0.2)", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 3 }}>AI SCANNED</span>
                  </div>
                  <div style={styles.fileActions}>
                    <button style={styles.dlBtn} onClick={() => handleDownload(item)}>
                      ⬇ Download
                    </button>
                    <button style={styles.scanBtn} onClick={() => handleManualScan(item)} title="Run AI security scan">
                      🔍
                    </button>
                    <button
                      style={styles.delBtn}
                      onClick={() => handleDelete(item)}
                      disabled={deleting === item.id}
                    >
                      {deleting === item.id ? "..." : "🗑"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  shell: { minHeight: "100vh", background: "#080c10", fontFamily: "'Exo 2', sans-serif", color: "#e8eaf0" },
  topbar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 32px", borderBottom: "1px solid #1e3040", background: "#0d1117", flexWrap: "wrap", gap: 12 },
  pageTitle: { fontSize: 18, fontWeight: 700, color: "#e8eaf0" },
  pageSub: { fontSize: 11, color: "#4a6070", marginTop: 2 },
  userChip: { background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.2)", color: "#00ff88", borderRadius: 20, padding: "5px 14px", fontSize: 12 },
  logoutBtn: { background: "transparent", border: "1px solid #1e3040", color: "#6b8090", borderRadius: 6, padding: "6px 14px", fontSize: 12, cursor: "pointer" },
  body: { padding: "28px 32px", display: "flex", flexDirection: "column", gap: 24, maxWidth: 960, margin: "0 auto" },
  section: { display: "flex", flexDirection: "column", gap: 14 },
  sectionTitle: { color: "#6b8090", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" },
  msg: { padding: "10px 16px", borderRadius: 6, border: "1px solid", fontSize: 13, background: "rgba(0,0,0,0.3)" },
  empty: { textAlign: "center", padding: "40px 20px", color: "#6b8090", fontSize: 14 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  fileGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 14 },
  fileCard: { background: "#0d1117", border: "1px solid #1e3040", borderRadius: 10, padding: "18px 16px", display: "flex", flexDirection: "column", gap: 8, transition: "border-color 0.2s" },
  fileIcon: { fontSize: 28 },
  fileName: { color: "#e8eaf0", fontSize: 13, fontWeight: 600, wordBreak: "break-all" },
  fileMeta: { display: "flex", justifyContent: "space-between", color: "#4a6070", fontSize: 11 },
  encBadge: { display: "inline-block", background: "rgba(0,255,136,0.08)", color: "#00ff88", border: "1px solid rgba(0,255,136,0.2)", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 3, letterSpacing: "0.05em" },
  fileActions: { display: "flex", gap: 6, marginTop: 4 },
  dlBtn: { flex: 1, background: "rgba(0,255,136,0.1)", color: "#00ff88", border: "1px solid rgba(0,255,136,0.2)", borderRadius: 5, padding: "6px", fontSize: 11, cursor: "pointer", fontWeight: 600 },
  scanBtn: { background: "rgba(0,170,255,0.1)", color: "#00aaff", border: "1px solid rgba(0,170,255,0.2)", borderRadius: 5, padding: "6px 8px", fontSize: 11, cursor: "pointer" },
  delBtn: { background: "rgba(255,68,68,0.08)", color: "#ff6060", border: "1px solid rgba(255,68,68,0.2)", borderRadius: 5, padding: "6px 8px", fontSize: 11, cursor: "pointer" },
};