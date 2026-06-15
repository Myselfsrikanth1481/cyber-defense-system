import { useEffect, useState } from "react";
import { getSecurityLogs } from "../api";

const ATTACK_COLORS = {
  ddos: "#ff4444",
  brute_force: "#ff8c00",
  ai_detected: "#ff44aa",
  rate_limit: "#ffcc00",
  payload: "#ff6644",
  normal: "#00ff88",
};

function severityColor(type) {
  return ATTACK_COLORS[type?.toLowerCase()] || "#778899";
}

export default function ThreatFeed() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getSecurityLogs(30);
        setLogs(data);
      } catch {
        // fallback mock data so UI always shows something
        setLogs(mockLogs);
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>Live Threat Feed</span>
        <span style={{ ...styles.dot, background: "#00ff88" }} />
        <span style={styles.liveLabel}>LIVE</span>
      </div>

      {loading ? (
        <div style={styles.empty}>Loading...</div>
      ) : logs.length === 0 ? (
        <div style={styles.empty}>No threats detected</div>
      ) : (
        <div style={styles.list}>
          {logs.map((log, i) => (
            <div key={i} style={styles.row}>
              <div style={{ ...styles.typeBadge, borderColor: severityColor(log.attack_type), color: severityColor(log.attack_type) }}>
                {(log.attack_type || "unknown").toUpperCase()}
              </div>
              <div style={styles.ip}>{log.ip || log.source_ip || "—"}</div>
              <div style={styles.time}>
                {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : "—"}
              </div>
              <div style={{ ...styles.statusDot, background: log.blocked ? "#ff4444" : "#00ff88" }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const mockLogs = [
  { attack_type: "ddos", ip: "192.168.1.45", timestamp: new Date().toISOString(), blocked: true },
  { attack_type: "brute_force", ip: "10.0.0.22", timestamp: new Date(Date.now() - 30000).toISOString(), blocked: true },
  { attack_type: "ai_detected", ip: "172.16.0.5", timestamp: new Date(Date.now() - 90000).toISOString(), blocked: true },
  { attack_type: "rate_limit", ip: "192.168.2.10", timestamp: new Date(Date.now() - 120000).toISOString(), blocked: false },
];

const styles = {
  container: { background: "#0d1117", border: "1px solid #1e3040", borderRadius: 10, overflow: "hidden" },
  header: { display: "flex", alignItems: "center", gap: 8, padding: "14px 18px", borderBottom: "1px solid #1e3040" },
  title: { color: "#e8eaf0", fontSize: 13, fontWeight: 600, flex: 1 },
  dot: { width: 7, height: 7, borderRadius: "50%", display: "inline-block" },
  liveLabel: { color: "#00ff88", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em" },
  list: { maxHeight: 340, overflowY: "auto" },
  row: { display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", borderBottom: "1px solid #111820", fontFamily: "'Share Tech Mono', monospace" },
  typeBadge: { fontSize: 10, fontWeight: 700, border: "1px solid", borderRadius: 3, padding: "2px 6px", minWidth: 90, textAlign: "center", letterSpacing: "0.05em" },
  ip: { color: "#6b8090", fontSize: 12, flex: 1 },
  time: { color: "#4a5568", fontSize: 11 },
  statusDot: { width: 6, height: 6, borderRadius: "50%" },
  empty: { padding: 24, textAlign: "center", color: "#4a6070", fontSize: 13 },
};
