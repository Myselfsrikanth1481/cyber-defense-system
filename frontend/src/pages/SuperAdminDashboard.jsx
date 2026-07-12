import { useEffect, useState, useRef } from "react";
import { getUsers, deleteUser, getSecurityLogs, getBlockedIPs, blockIP, unblockIP, getMetrics, getLoginLogs, blockUser, unblockUser } from "../api";
import Messaging from "./Messaging";

function formatTime(ts) {
  if (!ts) return "—";
  let str = String(ts);
  if (!str.endsWith("Z") && !str.includes("+")) str = str + "Z";
  const d = new Date(str);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  });
}

function formatTimeShort(ts) {
  if (!ts) return "—";
  let str = String(ts);
  if (!str.endsWith("Z") && !str.includes("+")) str = str + "Z";
  const d = new Date(str);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
}

// ── Leaflet Threat Map ──
function ThreatMap({ logs }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const attackPoints = logs.filter(l => (l.lat || l.latitude) && (l.lon || l.longitude));

  useEffect(() => {
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    const initMap = () => {
      if (!mapRef.current || mapInstanceRef.current) return;
      const L = window.L;
      const map = L.map(mapRef.current, {
        center: [20, 0], zoom: 2, minZoom: 2, maxZoom: 18,
        zoomControl: true, attributionControl: false,
        worldCopyJump: false, maxBoundsViscosity: 0.5,
        inertia: true, dragging: true, scrollWheelZoom: true,
        doubleClickZoom: true, tap: false, zoomSnap: 0.5, zoomDelta: 0.5,
      });
      map.setMaxBounds(L.latLngBounds(L.latLng(-85, -180), L.latLng(85, 180)));
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        maxZoom: 18, noWrap: true, bounds: [[-90, -180], [90, 180]],
      }).addTo(map);
      const container = map.getContainer();
      container.style.cursor = "grab";
      map.on("mousedown", () => { container.style.cursor = "grabbing"; });
      map.on("mouseup", () => { container.style.cursor = "grab"; });
      map.on("dblclick", () => { if (map.getZoom() <= 2) map.setView([20, 0], 2, { animate: true }); });
      mapInstanceRef.current = map;
    };
    if (window.L) { initMap(); }
    else {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = initMap;
      document.head.appendChild(script);
    }
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.L) return;
    const L = window.L;
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];
    attackPoints.forEach((point) => {
      const lat = point.lat || point.latitude;
      const lon = point.lon || point.longitude;
      const icon = L.divIcon({
        className: "",
        html: `<div style="position:relative;width:24px;height:24px;">
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:24px;height:24px;border-radius:50%;background:rgba(255,50,50,0.15);border:1px solid rgba(255,50,50,0.5);animation:leaflet-pulse 2s infinite;"></div>
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:11px;height:11px;border-radius:50%;background:#ff3333;box-shadow:0 0 8px #ff3333;cursor:pointer;"></div>
        </div>`,
        iconSize: [24, 24], iconAnchor: [12, 12],
      });
      const marker = L.marker([lat, lon], { icon });
      marker.bindPopup(`
        <div style="background:#0d1117;color:#e8eaf0;border:1px solid #ff4444;border-radius:8px;padding:12px 14px;font-family:monospace;font-size:12px;min-width:180px;">
          <div style="color:#ff5555;font-weight:bold;margin-bottom:6px;">🔴 ${point.attack_type || "Unknown"}</div>
          <div style="color:#8090a0;margin-bottom:3px;">IP: <span style="color:#c0d0e0">${point.ip || "—"}</span></div>
          <div style="color:#8090a0;margin-bottom:3px;">📍 <span style="color:#c0d0e0">${point.city ? point.city + ", " : ""}${point.country || "—"}</span></div>
          <div style="color:#8090a0;">🕐 <span style="color:#8090a0">${formatTimeShort(point.timestamp)}</span></div>
        </div>
      `, { className: "leaflet-dark-popup" });
      marker.on("click", () => { map.flyTo([lat, lon], 10, { animate: true, duration: 1.0 }); marker.openPopup(); });
      marker.addTo(map);
      markersRef.current.push(marker);
    });
  }, [attackPoints.length]);

  return (
    <div style={{ background: "#0d1520", borderRadius: 12, border: "1px solid #1e3040", padding: "16px", position: "relative" }}>
      <style>{`
        @keyframes leaflet-pulse { 0% { transform: translate(-50%,-50%) scale(1); opacity: 0.7; } 100% { transform: translate(-50%,-50%) scale(2.8); opacity: 0; } }
        .leaflet-dark-popup .leaflet-popup-content-wrapper { background: transparent !important; box-shadow: none !important; padding: 0 !important; }
        .leaflet-dark-popup .leaflet-popup-content { margin: 0 !important; }
        .leaflet-dark-popup .leaflet-popup-tip { background: #ff4444 !important; }
        .leaflet-container { background: #0d1520 !important; }
        .leaflet-tile-pane { filter: saturate(1.4) brightness(0.85) hue-rotate(10deg); }
        .leaflet-control-zoom a { background: #0d1117 !important; color: #00ff88 !important; border-color: #1e3040 !important; }
        .leaflet-control-zoom a:hover { background: #1e3040 !important; }
      `}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ color: "#6b8090", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em" }}>🌍 REAL-TIME THREAT MAP</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 10, color: "#4a6070" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff4444", display: "inline-block" }} />Attack Origin
          </span>
          <span style={{ color: "#6b8090" }}>Click dot → zoom in · Scroll to zoom · Dbl-click → reset</span>
          <span>{attackPoints.length} locations tracked</span>
        </div>
      </div>
      <div ref={mapRef} style={{ width: "100%", height: "420px", borderRadius: 8, overflow: "hidden" }} />
      {attackPoints.length === 0 && (
        <div style={{ position: "absolute", bottom: 30, left: "50%", transform: "translateX(-50%)", background: "rgba(6,10,15,0.85)", borderRadius: 8, padding: "10px 20px", color: "#4a6070", fontSize: 12, textAlign: "center", pointerEvents: "none" }}>
          🌍 No geo-located attacks yet
        </div>
      )}
      {attackPoints.length > 0 && (
        <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
          {[...new Map(attackPoints.map(p => [p.country, p])).values()].slice(0, 6).map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "#4a6070" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff4444", display: "inline-block" }} />
              {p.country || "Unknown"} — {p.attack_type || "Attack"}
            </div>
          ))}
          {attackPoints.length > 6 && <span style={{ fontSize: 10, color: "#2a4030" }}>+{attackPoints.length - 6} more</span>}
        </div>
      )}
    </div>
  );
}

// ── Invite Admin Panel ──
function InviteAdminPanel() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [newCode, setNewCode] = useState(null);
  const token = () => localStorage.getItem("token");

  async function loadInvites() {
    try {
      const res = await fetch("https://cyber-defense-system-1422.onrender.com/admin-invite/pending", { headers: { Authorization: `Bearer ${token()}` } });
      if (res.ok) setInvites(await res.json());
    } catch (_) {}
  }

  useEffect(() => { loadInvites(); }, []);

  async function handleCreate() {
    if (!name.trim() || !email.trim() || !phone.trim()) return setError("All fields are required");
    setLoading(true); setError(""); setSuccess(""); setNewCode(null);
    try {
      const res = await fetch("https://cyber-defense-system-1422.onrender.com/admin-invite/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ name, email, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to create invite");
      setNewCode(data.code);
      setSuccess(`Invite created for ${name}. Review and approve below.`);
      setName(""); setEmail(""); setPhone("");
      loadInvites();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleApprove(id) {
    try {
      const res = await fetch(`https://cyber-defense-system-1422.onrender.com/admin-invite/approve/${id}`, { method: "POST", headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      setSuccess("✅ Approved! Registration email sent.");
      loadInvites();
    } catch (e) { setError(e.message); }
  }

  async function handleDelete(id) {
    if (!window.confirm("Are you sure you want to delete this invite?")) return;
    try {
      const res = await fetch(`https://cyber-defense-system-1422.onrender.com/admin-invite/reject/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token()}` } });
      if (!res.ok) throw new Error("Failed to delete invite");
      setSuccess("🗑️ Invite deleted successfully.");
      loadInvites();
    } catch (e) { setError(e.message); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ background: "#0d1117", border: "1px solid #1e3040", borderRadius: 10, padding: "20px 24px" }}>
        <div style={{ color: "#ff8800", fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 16 }}>➕ CREATE NEW ADMIN INVITE</div>
        {error && <div style={{ background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.3)", borderRadius: 8, padding: "10px 14px", color: "#ff6060", fontSize: 13, marginBottom: 12 }}>⚠️ {error}</div>}
        {success && <div style={{ background: "rgba(0,255,136,0.05)", border: "1px solid rgba(0,255,136,0.2)", borderRadius: 8, padding: "10px 14px", color: "#00ff88", fontSize: 13, marginBottom: 12 }}>✅ {success}</div>}
        {newCode && (
          <div style={{ background: "rgba(255,136,0,0.08)", border: "1px solid rgba(255,136,0,0.3)", borderRadius: 8, padding: "14px 18px", marginBottom: 16 }}>
            <div style={{ color: "#ff8800", fontSize: 11, fontWeight: 700, marginBottom: 6 }}>GENERATED CODE — Approve below to send via Email</div>
            <div style={{ color: "#e8eaf0", fontSize: 28, fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.3em" }}>{newCode}</div>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
          {[["FULL NAME", name, setName, "e.g. John Smith"], ["EMAIL ADDRESS", email, setEmail, "e.g. john@company.com"], ["EMAIL TO SEND CODE", phone, setPhone, "e.g. john@gmail.com"]].map(([label, val, setter, ph]) => (
            <div key={label}>
              <div style={{ color: "#4a6070", fontSize: 11, fontWeight: 700, marginBottom: 6 }}>{label}</div>
              <input style={{ background: "#080c10", border: "1px solid #1e3040", borderRadius: 6, padding: "10px 12px", color: "#e8eaf0", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" }} placeholder={ph} value={val} onChange={e => setter(e.target.value)} />
            </div>
          ))}
        </div>
        <button style={{ background: "rgba(255,136,0,0.15)", color: "#ff8800", border: "1px solid rgba(255,136,0,0.4)", borderRadius: 6, padding: "10px 24px", cursor: "pointer", fontSize: 13, fontWeight: 700 }} onClick={handleCreate} disabled={loading}>
          {loading ? "Creating..." : "➕ Create Invite"}
        </button>
      </div>

      <div style={{ background: "#0d1117", border: "1px solid #1e3040", borderRadius: 10, padding: "20px 24px" }}>
        <div style={{ color: "#6b8090", fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 16 }}>📋 PENDING INVITES ({invites.length})</div>
        {invites.length === 0 ? <div style={{ color: "#4a6070", fontSize: 13 }}>No pending invites yet</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {invites.map(inv => (
              <div key={inv.id} style={{ background: "#080c10", border: `1px solid ${inv.approved ? "rgba(0,255,136,0.2)" : "rgba(255,136,0,0.2)"}`, borderRadius: 8, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: "#e8eaf0", fontWeight: 700, fontSize: 14 }}>{inv.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: inv.approved ? "rgba(0,255,136,0.1)" : "rgba(255,136,0,0.1)", color: inv.approved ? "#00ff88" : "#ff8800", border: `1px solid ${inv.approved ? "rgba(0,255,136,0.3)" : "rgba(255,136,0,0.3)"}` }}>
                      {inv.approved ? "✅ APPROVED — EMAIL SENT" : "⏳ PENDING APPROVAL"}
                    </span>
                  </div>
                  <div style={{ color: "#6b8090", fontSize: 12 }}>{inv.email} · {inv.phone}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "#4a6070", fontSize: 11 }}>Code:</span>
                    <span style={{ color: "#ff8800", fontFamily: "monospace", fontSize: 13, fontWeight: 700, letterSpacing: "0.2em" }}>{inv.code}</span>
                  </div>
                  <div style={{ color: "#4a6070", fontSize: 11 }}>Expires: {inv.expires_at ? new Date(inv.expires_at).toLocaleString() : "—"}</div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  {!inv.approved && <button style={{ background: "rgba(0,255,136,0.15)", color: "#00ff88", border: "1px solid rgba(0,255,136,0.4)", borderRadius: 6, padding: "8px 16px", cursor: "pointer", fontSize: 12, fontWeight: 700 }} onClick={() => handleApprove(inv.id)}>✅ Approve & Send Email</button>}
                  <button style={{ background: "rgba(255,68,68,0.15)", color: "#ff6060", border: "1px solid rgba(255,68,68,0.4)", borderRadius: 6, padding: "8px 16px", cursor: "pointer", fontSize: 12, fontWeight: 700 }} onClick={() => handleDelete(inv.id)}>🗑️ Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const TABS = ["dashboard", "users", "login-logs", "logs", "ips", "metrics", "messages", "invites"];

export default function SuperAdminDashboard({ user, onLogout }) {
  const [tab, setTab] = useState("dashboard");
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loginLogs, setLoginLogs] = useState([]);
  const [blockedIPs, setBlockedIPs] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [attackMap, setAttackMap] = useState([]);
  const [ipInput, setIpInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);
  const [blockConfirm, setBlockConfirm] = useState(null);
  const [unread, setUnread] = useState(0);

  async function load() {
    setLoading(true);
    try {
      const [u, l, b, m, ll] = await Promise.all([
        getUsers(),
        getSecurityLogs(200),
        getBlockedIPs(),
        getMetrics(),
        getLoginLogs().catch(() => []),
      ]);
      setUsers(Array.isArray(u) ? u : []);
      setLogs(Array.isArray(l) ? l : []);
      setBlockedIPs(Array.isArray(b) ? b : []);
      setMetrics(m);
      setLoginLogs(Array.isArray(ll) ? ll : []);
      try {
        const token = localStorage.getItem("token");
        const mapRes = await fetch("https://cyber-defense-system-1422.onrender.com/admin/attack-map", { headers: { Authorization: `Bearer ${token}` } });
        if (mapRes.ok) setAttackMap(await mapRes.json());
      } catch { setAttackMap([]); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await fetch("https://cyber-defense-system-1422.onrender.com/documents/unread-total", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
        if (res.ok) { const d = await res.json(); setUnread(d.unread || 0); }
      } catch (_) {}
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 5000);
    return () => clearInterval(interval);
  }, []);

  async function handleDelete(u) {
    try { await deleteUser(u.id); setConfirm(null); load(); }
    catch (e) { alert(e.message); }
  }

  async function handleBlockUser(u) {
    try {
      if (u.is_blocked) { await unblockUser(u.id); }
      else { await blockUser(u.id); }
      setBlockConfirm(null);
      load();
    } catch (e) { alert(e.message); }
  }

  async function handleBlock() {
    if (!ipInput.trim()) return;
    try { await blockIP(ipInput.trim()); setIpInput(""); load(); }
    catch (e) { alert(e.message); }
  }

  async function handleUnblock(ip) {
    try { await unblockIP(ip); load(); }
    catch (e) { alert(e.message); }
  }

  const roleColor = (r) => ({ super_admin: "#ff8800", admin: "#00ff88", user: "#00aaff" }[r] || "#6b8090");
  const statusColor = (status) => ({ success: "#00ff88", blocked: "#ff4444", suspicious: "#ff8800" }[status] || "#6b8090");
  const statusIcon = (status) => ({ success: "✅", blocked: "🚫", suspicious: "⚠️" }[status] || "❓");
  const admins = users.filter(u => u.role === "admin");
  const regularUsers = users.filter(u => u.role === "user");
  const superAdmins = users.filter(u => u.role === "super_admin");

  function AttackTypeChart() {
    const counts = {};
    logs.forEach(l => { counts[l.attack_type || "Unknown"] = (counts[l.attack_type || "Unknown"] || 0) + 1; });
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const max = Math.max(...entries.map(e => e[1]), 1);
    const colors = ["#ff4444", "#ff8800", "#ffcc00", "#00ff88", "#00aaff", "#aa88ff"];
    return (
      <div style={s.chartCard}>
        <div style={s.chartTitle}>⚔️ Attack Types</div>
        {entries.length === 0 ? <div style={s.noData}>No attack data yet</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            {entries.map(([type, count], i) => (
              <div key={type}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: "#c8cad0", fontSize: 12 }}>{type}</span>
                  <span style={{ color: colors[i % colors.length], fontSize: 12, fontWeight: 700 }}>{count}</span>
                </div>
                <div style={{ height: 6, background: "#111820", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(count / max) * 100}%`, background: colors[i % colors.length], borderRadius: 3, transition: "width 0.5s" }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function TimelineChart() {
    const hourCounts = {};
    logs.forEach(l => { if (l.timestamp) { const h = new Date(l.timestamp).getHours(); hourCounts[h] = (hourCounts[h] || 0) + 1; } });
    const hours = Array.from({ length: 24 }, (_, i) => ({ h: i, count: hourCounts[i] || 0 }));
    const max = Math.max(...hours.map(h => h.count), 1);
    return (
      <div style={s.chartCard}>
        <div style={s.chartTitle}>📈 Attack Timeline (24h)</div>
        {logs.length === 0 ? <div style={s.noData}>No timeline data yet</div> : (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 80, marginTop: 16 }}>
            {hours.map(({ h, count }) => (
              <div key={h} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <div style={{ width: "100%", background: count > 0 ? "#ff8800" : "#1e3040", height: `${Math.max((count / max) * 70, count > 0 ? 4 : 2)}px`, borderRadius: "2px 2px 0 0", opacity: count > 0 ? 1 : 0.3, transition: "height 0.3s" }} />
                {h % 6 === 0 && <span style={{ color: "#4a6070", fontSize: 9 }}>{h}h</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function LiveThreatStats() {
    const recentLogs = logs.filter(l => Date.now() - new Date(l.timestamp).getTime() < 86400000).length;
    const stats = [
      { label: "Total Detections", value: metrics?.total_detections || 0, color: "#ff8800" },
      { label: "Blocked IPs", value: metrics?.blocked || 0, color: "#ff4444" },
      { label: "Last 24h", value: recentLogs, color: "#ffcc00" },
      { label: "DDoS Attacks", value: metrics?.ddos_count || 0, color: "#aa88ff" },
      { label: "Brute Force", value: metrics?.brute_force_count || 0, color: "#ff6060" },
      { label: "SQL Injection", value: metrics?.sql_injection_count || 0, color: "#00aaff" },
      { label: "XSS Attacks", value: metrics?.xss_count || 0, color: "#00ff88" },
      { label: "Port Scans", value: metrics?.port_scan_count || 0, color: "#ff8800" },
    ];
    return (
      <div style={s.chartCard}>
        <div style={s.chartTitle}>📊 Threat Statistics</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
          {stats.map(stat => (
            <div key={stat.label} style={{ background: "#080c10", borderRadius: 8, padding: "10px 12px", border: `1px solid ${stat.color}22` }}>
              <div style={{ color: "#4a6070", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 4 }}>{stat.label.toUpperCase()}</div>
              <div style={{ color: stat.color, fontSize: 20, fontWeight: 700, fontFamily: "'Share Tech Mono', monospace" }}>{stat.value}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── User row with block/unblock ────────────────────────────────────────────
  function UserRow({ u, i }) {
    return (
      <tr style={{ borderBottom: "1px solid #0d1520", background: u.is_blocked ? "rgba(255,68,68,0.04)" : "transparent" }}>
        <td style={{ ...s.td, color: "#4a6070", fontSize: 11 }}>{i + 1}</td>
        <td style={{ ...s.td, fontWeight: 700, color: u.is_blocked ? "#ff6060" : (u.role === "admin" ? "#00ff88" : "#00aaff") }}>
          {u.username}
          {u.is_blocked && <span style={{ marginLeft: 6, fontSize: 9, background: "rgba(255,68,68,0.2)", color: "#ff4444", padding: "1px 6px", borderRadius: 4, border: "1px solid rgba(255,68,68,0.4)" }}>BLOCKED</span>}
        </td>
        <td style={{ ...s.td, color: "#6b8090", fontSize: 12 }}>{u.email}</td>
        <td style={{ ...s.td, textAlign: "center" }}><span style={{ fontSize: 14 }}>{u.has_face ? "✅" : "❌"}</span></td>
        <td style={{ ...s.td, color: "#6b8090", fontSize: 11 }}>{u.last_login && u.last_login !== "None" ? formatTime(u.last_login) : "Never"}</td>
        <td style={{ ...s.td, color: "#4a6070", fontSize: 11, fontFamily: "monospace" }}>{u.last_login_ip || "—"}</td>
        <td style={s.td}>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              style={{ background: u.is_blocked ? "rgba(0,255,136,0.15)" : "rgba(255,136,0,0.15)", color: u.is_blocked ? "#00ff88" : "#ff8800", border: `1px solid ${u.is_blocked ? "rgba(0,255,136,0.4)" : "rgba(255,136,0,0.4)"}`, borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}
              onClick={() => setBlockConfirm(u)}
            >
              {u.is_blocked ? "🔓 Unblock" : "🔒 Block"}
            </button>
            <button
              style={{ background: "rgba(255,68,68,0.15)", color: "#ff6060", border: "1px solid rgba(255,68,68,0.4)", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}
              onClick={() => setConfirm(u)}
            >
              🗑
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <div style={s.shell}>

      {/* ── Delete Confirm Modal ── */}
      {confirm && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={{ color: "#ff6060", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>⚠️ Confirm Removal</div>
            <p style={{ color: "#c8cad0", fontSize: 14, marginBottom: 6 }}>Permanently remove:</p>
            <p style={{ color: "#e8eaf0", fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{confirm.username}</p>
            <p style={{ color: "#4a6070", fontSize: 12, marginBottom: 20 }}>Role: <span style={{ color: roleColor(confirm.role) }}>{confirm.role?.toUpperCase()}</span> · Cannot be undone.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button style={{ ...s.btn, background: "rgba(255,68,68,0.2)", color: "#ff6060", border: "1px solid rgba(255,68,68,0.4)", flex: 1 }} onClick={() => handleDelete(confirm)}>🗑 Remove User</button>
              <button style={{ ...s.btn, background: "transparent", color: "#6b8090", border: "1px solid #1e3040", flex: 1 }} onClick={() => setConfirm(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Block/Unblock Confirm Modal ── */}
      {blockConfirm && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={{ color: blockConfirm.is_blocked ? "#00ff88" : "#ff8800", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              {blockConfirm.is_blocked ? "🔓 Unblock User?" : "🔒 Block User?"}
            </div>
            <p style={{ color: "#c8cad0", fontSize: 14, marginBottom: 6 }}>
              {blockConfirm.is_blocked ? "Restore access for:" : "Block account access for:"}
            </p>
            <p style={{ color: "#e8eaf0", fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{blockConfirm.username}</p>
            <p style={{ color: "#4a6070", fontSize: 12, marginBottom: 20 }}>
              {blockConfirm.is_blocked ? "User will be able to login again." : "User cannot login until unblocked by super admin."}
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                style={{ ...s.btn, background: blockConfirm.is_blocked ? "rgba(0,255,136,0.2)" : "rgba(255,136,0,0.2)", color: blockConfirm.is_blocked ? "#00ff88" : "#ff8800", border: `1px solid ${blockConfirm.is_blocked ? "rgba(0,255,136,0.4)" : "rgba(255,136,0,0.4)"}`, flex: 1 }}
                onClick={() => handleBlockUser(blockConfirm)}
              >
                {blockConfirm.is_blocked ? "🔓 Unblock" : "🔒 Block"}
              </button>
              <button style={{ ...s.btn, background: "transparent", color: "#6b8090", border: "1px solid #1e3040", flex: 1 }} onClick={() => setBlockConfirm(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Topbar */}
      <div style={s.topbar}>
        <div>
          <div style={s.pageTitle}>👑 Super Admin Console</div>
          <div style={s.pageSub}>Full system access · {superAdmins.length} super admin · {admins.length} admins · {regularUsers.length} users · {blockedIPs.length} blocked IPs · Auto-refresh 30s</div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={s.liveIndicator}><span style={s.liveDot} />LIVE</div>
          <span style={{ ...s.chip, background: "rgba(255,136,0,0.1)", color: "#ff8800", border: "1px solid rgba(255,136,0,0.3)" }}>👑 {user?.username}</span>
          <button style={s.refreshBtn} onClick={load}>↺ Refresh</button>
          <button style={s.logoutBtn} onClick={onLogout}>Logout</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        {TABS.map(t => (
          <button key={t} style={{ ...s.tab, ...(tab === t ? s.tabActive : {}) }} onClick={() => setTab(t)}>
            {t === "dashboard" ? "📡 Dashboard"
              : t === "users" ? `👥 Users (${users.length})`
              : t === "login-logs" ? `🔐 Login Activity (${loginLogs.length})`
              : t === "logs" ? `📋 Attack Logs (${logs.length})`
              : t === "ips" ? `🚫 Blocked (${blockedIPs.length})`
              : t === "invites" ? "➕ Invite Admin"
              : t === "messages" ? (
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  💬 Messages {unread > 0 && <span style={{ background: "#ff4444", color: "#fff", borderRadius: 10, fontSize: 10, fontWeight: 700, padding: "1px 5px" }}>{unread}</span>}
                </span>
              ) : "📊 Metrics"}
          </button>
        ))}
      </div>

      <div style={s.body}>
        {loading && tab !== "messages" && tab !== "invites" ? (
          <div style={s.empty}>⏳ Loading system data...</div>

        ) : tab === "dashboard" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              {[
                { icon: "👥", label: "Total Users", value: users.length, color: "#00aaff" },
                { icon: "🚨", label: "Total Threats", value: metrics?.total_detections || 0, color: "#ff4444" },
                { icon: "🚫", label: "IPs Blocked", value: metrics?.blocked || 0, color: "#ff8800" },
                { icon: "🎯", label: "AI Accuracy", value: `${metrics?.accuracy || 0}%`, color: "#00ff88" },
              ].map(stat => (
                <div key={stat.label} style={{ background: "#0d1117", border: `1px solid ${stat.color}22`, borderRadius: 10, padding: "16px 20px" }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{stat.icon}</div>
                  <div style={{ color: stat.color, fontSize: 24, fontWeight: 700, fontFamily: "'Share Tech Mono', monospace" }}>{stat.value}</div>
                  <div style={{ color: "#4a6070", fontSize: 11, marginTop: 4, fontWeight: 600 }}>{stat.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {[{ label: "Super Admins", count: superAdmins.length, color: "#ff8800" }, { label: "Admins", count: admins.length, color: "#00ff88" }, { label: "Users", count: regularUsers.length, color: "#00aaff" }].map(card => (
                <div key={card.label} style={{ ...s.chartCard, borderColor: card.color + "33" }}>
                  <div style={{ color: "#6b8090", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em" }}>{card.label.toUpperCase()}</div>
                  <div style={{ color: card.color, fontSize: 32, fontWeight: 700, fontFamily: "'Share Tech Mono', monospace", marginTop: 8 }}>{card.count}</div>
                </div>
              ))}
            </div>
            <ThreatMap logs={attackMap.length > 0 ? attackMap : logs} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <AttackTypeChart />
              <LiveThreatStats />
            </div>
            <TimelineChart />
            <div style={s.card}>
              <div style={s.cardTitle}>🚨 Recent Security Events</div>
              {logs.length === 0 ? <div style={{ color: "#4a6070", fontSize: 13, marginTop: 10 }}>No events yet</div>
                : logs.slice(0, 5).map((l, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < 4 ? "1px solid #0d1520" : "none" }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <span style={{ fontSize: 16 }}>🔴</span>
                      <div>
                        <div style={{ color: "#e8eaf0", fontSize: 13, fontWeight: 600 }}>{l.attack_type || "Unknown Attack"}</div>
                        <div style={{ color: "#4a6070", fontSize: 11, fontFamily: "monospace" }}>{l.ip || "—"} {l.country ? `· ${l.country}` : ""}</div>
                      </div>
                    </div>
                    <div style={{ color: "#4a6070", fontSize: 11 }}>{formatTimeShort(l.timestamp)}</div>
                  </div>
                ))}
            </div>
          </div>

        ) : tab === "users" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {[{ label: "Super Admins", count: superAdmins.length, color: "#ff8800" }, { label: "Admins", count: admins.length, color: "#00ff88" }, { label: "Users", count: regularUsers.length, color: "#00aaff" }].map(card => (
                <div key={card.label} style={{ ...s.metricCard, borderColor: card.color + "33" }}>
                  <div style={{ color: "#6b8090", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em" }}>{card.label.toUpperCase()}</div>
                  <div style={{ color: card.color, fontSize: 32, fontWeight: 700, fontFamily: "'Share Tech Mono', monospace" }}>{card.count}</div>
                </div>
              ))}
            </div>

            {/* Admins */}
            <div>
              <div style={{ color: "#ff8800", fontSize: 13, fontWeight: 700, marginBottom: 10 }}>🛡️ Admins ({admins.length})</div>
              <div style={{ ...s.tableWrap, maxHeight: "35vh", overflowY: "auto" }}>
                <table style={{ ...s.table, tableLayout: "fixed" }}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                    <tr>{["#", "Username", "Email", "Face ID", "Last Login", "Last IP", "Actions"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {admins.length === 0
                      ? <tr><td colSpan={8} style={{ ...s.td, textAlign: "center", color: "#4a6070" }}>No admins found</td></tr>
                      : admins.map((u, i) => <UserRow key={u.id} u={u} i={i} />)}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Users */}
            <div>
              <div style={{ color: "#00aaff", fontSize: 13, fontWeight: 700, marginBottom: 10 }}>👤 Users ({regularUsers.length})</div>
              <div style={{ ...s.tableWrap, maxHeight: "35vh", overflowY: "auto" }}>
                <table style={{ ...s.table, tableLayout: "fixed" }}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                    <tr>{["#", "Username", "Email", "Face ID", "Last Login", "Last IP", "Actions"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {regularUsers.length === 0
                      ? <tr><td colSpan={8} style={{ ...s.td, textAlign: "center", color: "#4a6070" }}>No users found</td></tr>
                      : regularUsers.map((u, i) => <UserRow key={u.id} u={u} i={i} />)}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        ) : tab === "login-logs" ? (

          /* ── Login Activity Tab ── */
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {[
                { label: "Total Logins", value: loginLogs.length, color: "#00ff88" },
                { label: "Blocked Attempts", value: loginLogs.filter(l => l.status === "blocked").length, color: "#ff4444" },
                { label: "Suspicious", value: loginLogs.filter(l => l.status === "suspicious").length, color: "#ff8800" },
              ].map(stat => (
                <div key={stat.label} style={{ background: "#0d1117", border: `1px solid ${stat.color}22`, borderRadius: 10, padding: "16px 20px" }}>
                  <div style={{ color: stat.color, fontSize: 28, fontWeight: 700, fontFamily: "'Share Tech Mono', monospace" }}>{stat.value}</div>
                  <div style={{ color: "#4a6070", fontSize: 11, marginTop: 4, fontWeight: 600 }}>{stat.label}</div>
                </div>
              ))}
            </div>

            <div style={{ ...s.tableWrap, maxHeight: "60vh", overflowY: "auto" }}>
              <table style={s.table}>
                <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                  <tr>{["Time", "Username", "Role", "IP Address", "Location", "Status"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {loginLogs.length === 0 ? (
                    <tr><td colSpan={6} style={{ ...s.td, textAlign: "center", color: "#4a6070" }}>No login activity yet — login with any account to see logs here</td></tr>
                  ) : loginLogs.map((l, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #0d1520", background: l.status === "blocked" ? "rgba(255,68,68,0.04)" : l.status === "suspicious" ? "rgba(255,136,0,0.03)" : "transparent" }}>
                      <td style={{ ...s.td, fontSize: 11, color: "#6b8090" }}>{formatTime(l.timestamp)}</td>
                      <td style={{ ...s.td, fontWeight: 700, color: "#e8eaf0" }}>{l.username}</td>
                      <td style={s.td}>
                        <span style={{ color: roleColor(l.role), fontWeight: 700, fontSize: 11, background: "rgba(0,0,0,0.3)", padding: "2px 8px", borderRadius: 4 }}>
                          {l.role?.toUpperCase().replace("_", " ") || "—"}
                        </span>
                      </td>
                      <td style={{ ...s.td, fontFamily: "monospace", color: "#c8cad0" }}>{l.ip || "—"}</td>
                      <td style={{ ...s.td, color: "#6b8090", fontSize: 11 }}>{l.city && l.country ? `${l.city}, ${l.country}` : l.country || "—"}</td>
                      <td style={s.td}>
                        <span style={{ color: statusColor(l.status), fontWeight: 700, fontSize: 11, background: `rgba(${l.status === "success" ? "0,255,136" : l.status === "blocked" ? "255,68,68" : "255,136,0"},0.1)`, padding: "3px 10px", borderRadius: 4, border: `1px solid ${statusColor(l.status)}33` }}>
                          {statusIcon(l.status)} {l.status?.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        ) : tab === "logs" ? (
          <div style={{ ...s.tableWrap, maxHeight: "70vh", overflowY: "auto" }}>
            <table style={s.table}>
              <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                <tr>{["Time", "IP Address", "Attack Type", "Confidence", "Location", "Blocked", "TX Hash"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {logs.length === 0
                  ? <tr><td colSpan={7} style={{ ...s.td, textAlign: "center", color: "#4a6070" }}>No attack logs yet</td></tr>
                  : logs.map((l, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #0d1520" }}>
                      <td style={{ ...s.td, fontSize: 11, color: "#6b8090" }}>{formatTime(l.timestamp)}</td>
                      <td style={{ ...s.td, fontFamily: "monospace", color: "#e8eaf0" }}>{l.ip || "—"}</td>
                      <td style={{ ...s.td, color: "#ff8800", fontWeight: 600 }}>{l.attack_type || "—"}</td>
                      <td style={{ ...s.td, color: "#00ff88" }}>{l.confidence ? `${(l.confidence * 100).toFixed(0)}%` : "—"}</td>
                      <td style={{ ...s.td, color: "#6b8090", fontSize: 11 }}>{l.city && l.country ? `${l.city}, ${l.country}` : l.country || "—"}</td>
                      <td style={{ ...s.td, textAlign: "center" }}><span style={{ color: l.blocked ? "#ff6060" : "#00ff88" }}>{l.blocked ? "🚫" : "✅"}</span></td>
                      <td style={{ ...s.td, fontFamily: "monospace", fontSize: 10, color: "#4a6070" }}>{l.tx_hash ? l.tx_hash.slice(0, 12) + "..." : "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

        ) : tab === "ips" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={s.card}>
              <div style={s.cardTitle}>Block an IP Address</div>
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <input style={{ ...s.input, flex: 1 }} placeholder="e.g. 192.168.1.100" value={ipInput} onChange={(e) => setIpInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleBlock()} />
                <button style={{ ...s.btn, background: "rgba(255,68,68,0.15)", color: "#ff6060", border: "1px solid rgba(255,68,68,0.4)", width: "auto", padding: "0 24px" }} onClick={handleBlock}>🚫 Block</button>
              </div>
            </div>
            <div style={s.card}>
              <div style={s.cardTitle}>Currently Blocked IPs ({blockedIPs.length})</div>
              {blockedIPs.length === 0 ? <div style={{ color: "#4a6070", fontSize: 13, marginTop: 12 }}>No IPs currently blocked</div>
                : blockedIPs.map((entry, i) => (
                  <div key={i} style={s.ipRow}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontFamily: "monospace", color: "#e8eaf0", fontSize: 14 }}>{entry.ip}</span>
                      <span style={{ color: "#4a6070", fontSize: 11 }}>{entry.reason && `Reason: ${entry.reason}`}{entry.blocked_by && ` · By: ${entry.blocked_by}`}{entry.created_at && ` · ${new Date(entry.created_at).toLocaleDateString()}`}</span>
                    </div>
                    <button style={s.unblockBtn} onClick={() => handleUnblock(entry.ip)}>Unblock</button>
                  </div>
                ))}
            </div>
          </div>

        ) : tab === "invites" ? (
          <InviteAdminPanel />

        ) : tab === "messages" ? (
          <Messaging user={user} />

        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
            {metrics ? Object.entries(metrics).filter(([k]) => k !== "attack_type_counts").map(([k, v]) => (
              <div key={k} style={s.metricCard}>
                <div style={s.metricLabel}>{k.replace(/_/g, " ").toUpperCase()}</div>
                <div style={s.metricValue}>{typeof v === "number" ? v.toLocaleString() : String(v)}</div>
              </div>
            )) : <div style={s.empty}>No metrics available</div>}
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  shell: { height: "100vh", display: "flex", flexDirection: "column", background: "#080c10", fontFamily: "'Exo 2', sans-serif", color: "#e8eaf0", overflow: "hidden" },
  topbar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 32px", borderBottom: "1px solid #1e3040", background: "#0d1117", flexShrink: 0 },
  pageTitle: { fontSize: 18, fontWeight: 700, color: "#e8eaf0" },
  pageSub: { fontSize: 11, color: "#4a6070", marginTop: 2 },
  chip: { borderRadius: 20, padding: "5px 14px", fontSize: 12, fontWeight: 700 },
  liveIndicator: { display: "flex", alignItems: "center", gap: 6, background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.3)", borderRadius: 20, padding: "4px 10px", fontSize: 10, fontWeight: 700, color: "#ff6060", letterSpacing: "0.1em" },
  liveDot: { width: 6, height: 6, background: "#ff4444", borderRadius: "50%", display: "inline-block" },
  refreshBtn: { background: "transparent", border: "1px solid #1e3040", color: "#00ff88", borderRadius: 6, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontFamily: "'Exo 2', sans-serif" },
  logoutBtn: { background: "transparent", border: "1px solid #1e3040", color: "#6b8090", borderRadius: 6, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontFamily: "'Exo 2', sans-serif" },
  tabs: { display: "flex", borderBottom: "1px solid #1e3040", background: "#0d1117", overflowX: "auto", flexShrink: 0 },
  tab: { padding: "12px 24px", background: "transparent", border: "none", borderBottom: "2px solid transparent", color: "#6b8090", fontSize: 13, cursor: "pointer", fontFamily: "'Exo 2', sans-serif", whiteSpace: "nowrap" },
  tabActive: { color: "#ff8800", borderBottomColor: "#ff8800" },
  body: { flex: 1, overflowY: "auto", overflowX: "hidden", padding: "28px 32px", maxHeight: "calc(100vh - 120px)" },
  empty: { textAlign: "center", padding: "60px", color: "#4a6070", fontSize: 14 },
  chartCard: { background: "#0d1117", border: "1px solid #1e3040", borderRadius: 10, padding: "20px 24px" },
  chartTitle: { color: "#6b8090", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" },
  noData: { color: "#2a4030", fontSize: 12, marginTop: 16, textAlign: "center" },
  card: { background: "#0d1117", border: "1px solid #1e3040", borderRadius: 10, padding: "20px 24px" },
  cardTitle: { color: "#6b8090", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 },
  tableWrap: { overflowX: "auto", borderRadius: 8, border: "1px solid #1e3040" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { padding: "10px 14px", textAlign: "left", color: "#4a6070", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", borderBottom: "1px solid #1e3040", background: "#0d1117", whiteSpace: "nowrap" },
  td: { padding: "10px 14px", color: "#c8cad0", verticalAlign: "middle" },
  delBtn: { background: "rgba(255,68,68,0.15)", color: "#ff6060", border: "1px solid rgba(255,68,68,0.4)", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 },
  input: { background: "#111820", border: "1px solid #1e3040", borderRadius: 6, padding: "10px 12px", color: "#e8eaf0", fontSize: 13, outline: "none", fontFamily: "monospace" },
  btn: { background: "#00ff88", color: "#080c10", border: "none", borderRadius: 6, padding: 11, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Exo 2', sans-serif" },
  ipRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #0d1520" },
  unblockBtn: { background: "rgba(0,255,136,0.1)", color: "#00ff88", border: "1px solid rgba(0,255,136,0.2)", borderRadius: 5, padding: "5px 14px", fontSize: 11, cursor: "pointer" },
  metricCard: { background: "#0d1117", border: "1px solid #1e3040", borderRadius: 10, padding: "20px", display: "flex", flexDirection: "column", gap: 8 },
  metricLabel: { color: "#4a6070", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em" },
  metricValue: { color: "#ff8800", fontSize: 28, fontWeight: 700, fontFamily: "'Share Tech Mono', monospace" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modal: { background: "#0d1117", border: "1px solid rgba(255,68,68,0.3)", borderRadius: 12, padding: "32px", maxWidth: 380, width: "100%" },
};