import { useEffect, useState } from "react";
import { getBlockedIPs, blockIP, unblockIP } from "../api";

export default function IPBlockPanel() {
  const [blockedIPs, setBlockedIPs] = useState([]);
  const [inputIP, setInputIP] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  async function load() {
    try {
      const data = await getBlockedIPs();
      setBlockedIPs(Array.isArray(data) ? data : []);
    } catch {
      setBlockedIPs([]);
    }
  }

  useEffect(() => { load(); }, []);

  function showMsg(text, ok = true) {
    setMessage({ text, ok });
    setTimeout(() => setMessage(null), 3000);
  }

  async function handleBlock() {
    if (!inputIP.trim()) return;
    setLoading(true);
    try {
      await blockIP(inputIP.trim());
      showMsg(`Blocked ${inputIP.trim()}`);
      setInputIP("");
      load();
    } catch (e) {
      showMsg(e.message, false);
    } finally { setLoading(false); }
  }

  async function handleUnblock(ip) {
    try {
      await unblockIP(ip);
      showMsg(`Unblocked ${ip}`);
      load();
    } catch (e) { showMsg(e.message, false); }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>IP Block Manager</span>
        <span style={styles.count}>{blockedIPs.length} blocked</span>
      </div>

      <div style={styles.inputRow}>
        <input
          style={styles.input}
          placeholder="Enter IP address (e.g. 192.168.1.1)"
          value={inputIP}
          onChange={(e) => setInputIP(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleBlock()}
        />
        <button style={styles.blockBtn} onClick={handleBlock} disabled={loading}>
          {loading ? "..." : "Block"}
        </button>
      </div>

      {message && (
        <div style={{ ...styles.msg, borderColor: message.ok ? "#00ff88" : "#ff4444", color: message.ok ? "#00ff88" : "#ff4444" }}>
          {message.text}
        </div>
      )}

      <div style={styles.list}>
        {blockedIPs.length === 0 ? (
          <div style={styles.empty}>No IPs blocked</div>
        ) : (
          blockedIPs.map((item, i) => (
            <div key={i} style={styles.row}>
              <span style={styles.ipText}>{item.ip || item}</span>
              <span style={styles.reason}>{item.reason || "manual"}</span>
              <button style={styles.unblockBtn} onClick={() => handleUnblock(item.ip || item)}>
                Unblock
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { background: "#0d1117", border: "1px solid #1e3040", borderRadius: 10, overflow: "hidden" },
  header: { display: "flex", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid #1e3040" },
  title: { color: "#e8eaf0", fontSize: 13, fontWeight: 600, flex: 1 },
  count: { background: "rgba(255,68,68,0.15)", color: "#ff4444", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, border: "1px solid rgba(255,68,68,0.3)" },
  inputRow: { display: "flex", gap: 8, padding: "14px 18px", borderBottom: "1px solid #1e3040" },
  input: { flex: 1, background: "#111820", border: "1px solid #1e3040", borderRadius: 6, padding: "9px 12px", color: "#e8eaf0", fontSize: 13, outline: "none", fontFamily: "'Share Tech Mono', monospace" },
  blockBtn: { background: "#ff4444", color: "#fff", border: "none", borderRadius: 6, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Exo 2', sans-serif" },
  msg: { margin: "10px 18px", padding: "8px 12px", borderRadius: 6, fontSize: 12, border: "1px solid", background: "rgba(0,0,0,0.2)" },
  list: { maxHeight: 220, overflowY: "auto" },
  row: { display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", borderBottom: "1px solid #111820", fontFamily: "'Share Tech Mono', monospace" },
  ipText: { color: "#e8eaf0", fontSize: 13, flex: 1 },
  reason: { color: "#4a6070", fontSize: 11 },
  unblockBtn: { background: "transparent", color: "#00ff88", border: "1px solid rgba(0,255,136,0.3)", borderRadius: 4, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontFamily: "'Exo 2', sans-serif" },
  empty: { padding: 20, textAlign: "center", color: "#4a6070", fontSize: 13 },
};
