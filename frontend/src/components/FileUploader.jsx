import { useRef, useState } from "react";
import { uploadVaultFile } from "../api";

export default function FileUploader({ onUploaded }) {
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");

  async function handleFiles(files) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > 50 * 1024 * 1024) { setError("File too large (max 50MB)"); return; }
    setError("");
    setUploading(true);
    setProgress(0);

    // simulate progress
    const timer = setInterval(() => setProgress((p) => Math.min((p || 0) + 15, 85)), 200);
    try {
      const result = await uploadVaultFile(file);
      clearInterval(timer);
      setProgress(100);
      setTimeout(() => { setProgress(null); setUploading(false); onUploaded && onUploaded(result); }, 800);
    } catch (e) {
      clearInterval(timer);
      setError(e.message);
      setProgress(null);
      setUploading(false);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div
      style={{ ...styles.dropzone, borderColor: dragging ? "#00ff88" : "#1e3040", background: dragging ? "rgba(0,255,136,0.04)" : "#111820" }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => !uploading && inputRef.current.click()}
    >
      <input ref={inputRef} type="file" style={{ display: "none" }} onChange={(e) => handleFiles(e.target.files)} />

      {uploading ? (
        <div style={styles.center}>
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: `${progress}%` }} />
          </div>
          <div style={styles.hint}>Encrypting and uploading... {progress}%</div>
        </div>
      ) : (
        <div style={styles.center}>
          <div style={styles.icon}>↑</div>
          <div style={styles.label}>Drop file here or click to upload</div>
          <div style={styles.hint}>AES-256 encrypted · max 50MB</div>
          {error && <div style={styles.error}>{error}</div>}
        </div>
      )}
    </div>
  );
}

const styles = {
  dropzone: { border: "1.5px dashed", borderRadius: 10, padding: "32px 20px", cursor: "pointer", transition: "all 0.2s", textAlign: "center" },
  center: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8 },
  icon: { fontSize: 28, color: "#00ff88", lineHeight: 1 },
  label: { color: "#e8eaf0", fontSize: 14, fontWeight: 500 },
  hint: { color: "#4a6070", fontSize: 12 },
  error: { color: "#ff4444", fontSize: 12, marginTop: 4 },
  progressBar: { width: 200, height: 4, background: "#1e3040", borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", background: "#00ff88", borderRadius: 2, transition: "width 0.2s" },
};
