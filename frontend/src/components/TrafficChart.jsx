import { useEffect, useRef, useState } from "react";
import { getTrafficStats } from "../api";

export default function TrafficChart() {
  const canvasRef = useRef(null);
  const [stats, setStats] = useState(null);
  const historyRef = useRef(Array(30).fill({ normal: 0, attack: 0 }));

  useEffect(() => {
    async function load() {
      try {
        const data = await getTrafficStats();
        historyRef.current = [...historyRef.current.slice(1), { normal: data.normal || 0, attack: data.attacks || 0 }];
        setStats(data);
      } catch {
        // simulate live data
        const n = Math.floor(Math.random() * 40) + 10;
        const a = Math.floor(Math.random() * 15);
        historyRef.current = [...historyRef.current.slice(1), { normal: n, attack: a }];
        setStats({ normal: n, attacks: a, total: n + a });
      }
      drawChart();
    }
    load();
    const id = setInterval(load, 2000);
    return () => clearInterval(id);
  }, []);

  function drawChart() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    const data = historyRef.current;
    const maxVal = Math.max(...data.map((d) => d.normal + d.attack), 1);

    ctx.clearRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = "#1a2535";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (h * i) / 4;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    const step = w / (data.length - 1);

    // Normal traffic area
    ctx.beginPath();
    ctx.strokeStyle = "#00ff88";
    ctx.lineWidth = 2;
    data.forEach((d, i) => {
      const x = i * step;
      const y = h - (d.normal / maxVal) * h * 0.9;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill under normal
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
    ctx.fillStyle = "rgba(0,255,136,0.05)";
    ctx.fill();

    // Attack traffic
    ctx.beginPath();
    ctx.strokeStyle = "#ff4444";
    ctx.lineWidth = 2;
    data.forEach((d, i) => {
      const x = i * step;
      const y = h - (d.attack / maxVal) * h * 0.9;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>Real-Time Traffic Monitor</span>
        <div style={styles.legend}>
          <span style={{ ...styles.dot, background: "#00ff88" }} /> Normal
          <span style={{ ...styles.dot, background: "#ff4444", marginLeft: 12 }} /> Attacks
        </div>
      </div>

      <canvas ref={canvasRef} width={560} height={140} style={styles.canvas} />

      {stats && (
        <div style={styles.statsRow}>
          <div style={styles.stat}><span style={{ color: "#00ff88" }}>{stats.normal ?? "—"}</span><br /><span style={styles.statLabel}>Normal</span></div>
          <div style={styles.stat}><span style={{ color: "#ff4444" }}>{stats.attacks ?? "—"}</span><br /><span style={styles.statLabel}>Attacks</span></div>
          <div style={styles.stat}><span style={{ color: "#e8eaf0" }}>{stats.total ?? "—"}</span><br /><span style={styles.statLabel}>Total</span></div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { background: "#0d1117", border: "1px solid #1e3040", borderRadius: 10, overflow: "hidden" },
  header: { display: "flex", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid #1e3040" },
  title: { color: "#e8eaf0", fontSize: 13, fontWeight: 600, flex: 1 },
  legend: { color: "#6b8090", fontSize: 11, display: "flex", alignItems: "center", gap: 4 },
  dot: { display: "inline-block", width: 8, height: 8, borderRadius: "50%" },
  canvas: { width: "100%", height: 140, display: "block" },
  statsRow: { display: "flex", borderTop: "1px solid #1e3040" },
  stat: { flex: 1, padding: "12px 18px", textAlign: "center", fontSize: 18, fontWeight: 700, fontFamily: "'Share Tech Mono', monospace", borderRight: "1px solid #1e3040" },
  statLabel: { fontSize: 10, color: "#4a6070", fontWeight: 400, fontFamily: "'Exo 2', sans-serif", letterSpacing: "0.08em" },
};
