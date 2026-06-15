import { useEffect, useState, useRef } from "react";
import {
  getSecurityLogs,
  getBlockedIPs,
  blockIP,
  unblockIP,
  getMetrics,
  getUsers,
  deleteUser,
} from "../api";
import Messaging from "./Messaging";

const BASE_URL = "http://localhost:8000";

function formatTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: true,
  });
}

function formatTimeShort(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
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
        center: [20, 0],
        zoom: 2,
        zoomControl: true,
        attributionControl: false,
        worldCopyJump: false,
        maxBoundsViscosity: 1.0,
        inertia: false,
        dragging: true,
        tap: false,
      });

      const southWest = L.latLng(-85, -180);
      const northEast = L.latLng(85, 180);
      map.setMaxBounds(L.latLngBounds(southWest, northEast));

      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19,
        noWrap: true,
        bounds: [[-90, -180], [90, 180]],
      }).addTo(map);

      const container = map.getContainer();
      container.style.cursor = "grab";
      map.on("mousedown", () => { container.style.cursor = "grabbing"; });
      map.on("mouseup", () => { container.style.cursor = "grab"; });
      map.on("dblclick", () => { map.setView([20, 0], 2, { animate: true }); });
      map.doubleClickZoom.disable();
      mapInstanceRef.current = map;
    };

    if (window.L) {
      initMap();
    } else {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = initMap;
      document.head.appendChild(script);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
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
        html: `
          <div style="position:relative;width:24px;height:24px;">
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:24px;height:24px;border-radius:50%;background:rgba(255,50,50,0.15);border:1px solid rgba(255,50,50,0.5);animation:leaflet-pulse 2s infinite;"></div>
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:11px;height:11px;border-radius:50%;background:#ff3333;box-shadow:0 0 8px #ff3333;cursor:pointer;"></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const city = point.city || "";
      const country = point.country || "Unknown";
      const ip = point.ip || "—";
      const type = point.attack_type || "Unknown Attack";
      const time = formatTimeShort(point.timestamp);

      const marker = L.marker([lat, lon], { icon });
      marker.bindPopup(`
        <div style="background:#0d1117;color:#e8eaf0;border:1px solid #ff4444;border-radius:8px;padding:12px 14px;font-family:monospace;font-size:12px;min-width:180px;">
          <div style="color:#ff5555;font-weight:bold;margin-bottom:6px;">🔴 ${type}</div>
          <div style="color:#8090a0;margin-bottom:3px;">IP: <span style="color:#c0d0e0">${ip}</span></div>
          <div style="color:#8090a0;margin-bottom:3px;">📍 <span style="color:#c0d0e0">${city ? city + ", " : ""}${country}</span></div>
          <div style="color:#8090a0;">🕐 <span style="color:#8090a0">${time}</span></div>
        </div>
      `, { className: "leaflet-dark-popup" });

      marker.on("click", () => {
        map.flyTo([lat, lon], 6, { animate: true, duration: 1.2 });
        marker.openPopup();
      });

      marker.addTo(map);
      markersRef.current.push(marker);
    });
  }, [attackPoints.length]);

  return (
    <div style={{ background: "#0d1520", borderRadius: 12, border: "1px solid #1e3040", padding: "16px", position: "relative" }}>
      <style>{`
        @keyframes leaflet-pulse {
          0%   { transform: translate(-50%,-50%) scale(1);   opacity: 0.7; }
          100% { transform: translate(-50%,-50%) scale(2.8); opacity: 0; }
        }
        .leaflet-dark-popup .leaflet-popup-content-wrapper { background: transparent !important; box-shadow: none !important; padding: 0 !important; }
        .leaflet-dark-popup .leaflet-popup-content { margin: 0 !important; }
        .leaflet-dark-popup .leaflet-popup-tip { background: #ff4444 !important; }
        .leaflet-container { background: #0d1520 !important; }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ color: "#6b8090", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em" }}>🌍 REAL-TIME THREAT MAP</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 10, color: "#4a6070" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff4444", display: "inline-block" }} />
            Attack Origin
          </span>
          <span style={{ color: "#6b8090" }}>Click dot → zoom in · Dbl-click map → reset</span>
          <span>{attackPoints.length} locations tracked</span>
        </div>
      </div>

      <div ref={mapRef} style={{ width: "100%", height: "380px", borderRadius: 8, overflow: "hidden" }} />

      {attackPoints.length === 0 && (
        <div style={{ position: "absolute", bottom: 30, left: "50%", transform: "translateX(-50%)", background: "rgba(6,10,15,0.85)", borderRadius: 8, padding: "10px 20px", color: "#4a6070", fontSize: 12, textAlign: "center", pointerEvents: "none" }}>
          🌍 No geo-located attacks yet — run attacks with external IPs to see pins
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

// ── Invite Panel (Super Admin Only) ──
function InvitePanel() {
  const [invites, setInvites] = useState([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [newCode, setNewCode] = useState(null);

  async function loadInvites() {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${BASE_URL}/admin-invite/pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setInvites(await res.json());
    } catch (_) {}
  }

  useEffect(() => { loadInvites(); }, []);

  async function handleCreate() {
    if (!name || !email || !phone) { setError("All fields are required"); return; }
    setLoading(true); setError(""); setSuccess(""); setNewCode(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${BASE_URL}/admin-invite/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, email, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to create invite");
      setNewCode(data.code);
      setSuccess(`Invite created for ${name}! Approve it below to send the SMS.`);
      setName(""); setEmail(""); setPhone("");
      loadInvites();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleApprove(id) {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${BASE_URL}/admin-invite/approve/${id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to approve");
      setSuccess("✅ Approved! SMS sent to user.");
      loadInvites();
    } catch (e) { setError(e.message); }
  }

  async function handleReject(id) {
    if (!window.confirm("Reject and delete this invite?")) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${BASE_URL}/admin-invite/reject/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to reject");
      loadInvites();
    } catch (e) { setError(e.message); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Create Invite */}
      <div style={s.card}>
        <div style={{ ...s.cardTitle, fontSize: 14, color: "#e8eaf0", marginBottom: 4 }}>🔐 Appoint New Admin</div>
        <div style={{ color: "#4a6070", fontSize: 12, marginBottom: 16 }}>
          Fill in the details of the person you want to appoint as admin. After creating, you must approve the invite to send the SMS code to their phone.
        </div>

        {error && <div style={{ background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.3)", borderRadius: 8, padding: "10px 14px", color: "#ff6060", fontSize: 12, marginBottom: 12 }}>⚠️ {error}</div>}
        {success && <div style={{ background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.3)", borderRadius: 8, padding: "10px 14px", color: "#00ff88", fontSize: 12, marginBottom: 12 }}>✅ {success}</div>}

        {newCode && (
          <div style={{ background: "#080c10", border: "1px solid rgba(0,255,136,0.3)", borderRadius: 8, padding: "14px 18px", marginBottom: 16, textAlign: "center" }}>
            <div style={{ color: "#4a6070", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 6 }}>GENERATED CODE (sent via SMS after approval)</div>
            <div style={{ color: "#00ff88", fontSize: 32, fontWeight: 700, letterSpacing: "0.3em", fontFamily: "monospace" }}>{newCode}</div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={is.label}>FULL NAME</div>
            <input style={is.input} placeholder="e.g. John Smith"
              value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <div style={is.label}>EMAIL ADDRESS</div>
            <input style={is.input} placeholder="john@example.com" type="email"
              value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <div style={is.label}>PHONE NUMBER (E.164 FORMAT)</div>
            <input style={is.input} placeholder="+91XXXXXXXXXX"
              value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
        </div>

        <button
          style={{ background: "linear-gradient(135deg,#00ff88,#00cc6a)", color: "#080c10", border: "none", borderRadius: 8, padding: "12px", fontSize: 13, fontWeight: 700, cursor: "pointer", width: "100%", marginTop: 16, opacity: loading ? 0.7 : 1 }}
          onClick={handleCreate} disabled={loading}>
          {loading ? "⏳ Creating..." : "🔐 Create Invite (Pending Your Approval)"}
        </button>
      </div>

      {/* Pending Invites */}
      <div style={s.card}>
        <div style={{ ...s.cardTitle, fontSize: 14, color: "#e8eaf0", marginBottom: 14 }}>
          📋 Pending Invites ({invites.length})
        </div>

        {invites.length === 0 ? (
          <div style={{ color: "#4a6070", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
            No pending invites — create one above
          </div>
        ) : invites.map(inv => (
          <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 0", borderBottom: "1px solid #0d1520" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: "#e8eaf0", fontWeight: 700, fontSize: 14 }}>{inv.name}</div>
              <div style={{ color: "#4a6070", fontSize: 11, marginTop: 2 }}>📧 {inv.email} · 📱 {inv.phone}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                <span style={{ fontFamily: "monospace", color: "#00aaff", fontSize: 14, fontWeight: 700, letterSpacing: "0.15em" }}>{inv.code}</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                  background: inv.approved ? "rgba(0,255,136,0.1)" : "rgba(255,136,0,0.1)",
                  color: inv.approved ? "#00ff88" : "#ff8800",
                  border: `1px solid ${inv.approved ? "rgba(0,255,136,0.3)" : "rgba(255,136,0,0.3)"}`,
                }}>
                  {inv.approved ? "✅ APPROVED — SMS SENT" : "⏳ AWAITING YOUR APPROVAL"}
                </span>
              </div>
              {inv.expires_at && (
                <div style={{ color: "#4a6070", fontSize: 10, marginTop: 4 }}>
                  Expires: {new Date(inv.expires_at).toLocaleString()}
                </div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
              {!inv.approved && (
                <button
                  style={{ background: "rgba(0,255,136,0.1)", color: "#00ff88", border: "1px solid rgba(0,255,136,0.3)", borderRadius: 6, padding: "7px 14px", cursor: "pointer", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}
                  onClick={() => handleApprove(inv.id)}>
                  ✅ Approve & Send SMS
                </button>
              )}
              <button
                style={{ background: "rgba(255,68,68,0.08)", color: "#ff6060", border: "1px solid rgba(255,68,68,0.2)", borderRadius: 6, padding: "7px 14px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}
                onClick={() => handleReject(inv.id)}>
                ✕ Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Invite Panel inner styles ──
const is = {
  label: { color: "#4a6070", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", marginBottom: 6 },
  input: { background: "#080c10", border: "1px solid #1e3040", borderRadius: 8, padding: "10px 14px", color: "#e8eaf0", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" },
};

export default function AdminSOC({ user, onLogout }) {
  const isSuperAdmin = user?.role === "super_admin";
  const TABS = isSuperAdmin
    ? ["dashboard", "logs", "ips", "users", "metrics", "messages", "invites"]
    : ["dashboard", "logs", "ips", "users", "metrics", "messages"];

  const [tab, setTab] = useState("dashboard");
  const [logs, setLogs] = useState([]);
  const [blockedIPs, setBlockedIPs] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [users, setUsers] = useState([]);
  const [attackMap, setAttackMap] = useState([]);
  const [ipInput, setIpInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);
  const [unread, setUnread] = useState(0);

  async function load() {
    setLoading(true);
    try {
      const [l, b, m, u] = await Promise.all([
        getSecurityLogs(200),
        getBlockedIPs(),
        getMetrics(),
        getUsers().catch(() => []),
      ]);
      setLogs(Array.isArray(l) ? l : []);
      setBlockedIPs(Array.isArray(b) ? b : []);
      setMetrics(m);
      setUsers(Array.isArray(u) ? u.filter(x => x.role !== "super_admin") : []);

      try {
        const token = localStorage.getItem("token");
        const mapRes = await fetch("http://localhost:8000/admin/attack-map", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (mapRes.ok) setAttackMap(await mapRes.json());
      } catch { setAttackMap([]); }

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await fetch("http://localhost:8000/documents/unread-total", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        if (res.ok) { const d = await res.json(); setUnread(d.unread || 0); }
      } catch (_) {}
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 5000);
    return () => clearInterval(interval);
  }, []);

  async function handleBlock() {
    if (!ipInput.trim()) return;
    try { await blockIP(ipInput.trim()); setIpInput(""); load(); }
    catch (e) { alert(e.message); }
  }

  async function handleUnblock(ip) {
    try { await unblockIP(ip); load(); }
    catch (e) { alert(e.message); }
  }

  async function handleDeleteUser(u) {
    try { await deleteUser(u.id); setConfirm(null); load(); }
    catch (e) { alert(e.message); }
  }

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
    logs.forEach(l => {
      if (l.timestamp) {
        const h = new Date(l.timestamp).getHours();
        hourCounts[h] = (hourCounts[h] || 0) + 1;
      }
    });
    const hours = Array.from({ length: 24 }, (_, i) => ({ h: i, count: hourCounts[i] || 0 }));
    const max = Math.max(...hours.map(h => h.count), 1);
    return (
      <div style={s.chartCard}>
        <div style={s.chartTitle}>📈 Attack Timeline (24h)</div>
        {logs.length === 0 ? <div style={s.noData}>No timeline data yet</div> : (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 80, marginTop: 16 }}>
            {hours.map(({ h, count }) => (
              <div key={h} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <div style={{ width: "100%", background: count > 0 ? "#00ff88" : "#1e3040", height: `${Math.max((count / max) * 70, count > 0 ? 4 : 2)}px`, borderRadius: "2px 2px 0 0", opacity: count > 0 ? 1 : 0.3, transition: "height 0.3s" }} />
                {h % 6 === 0 && <span style={{ color: "#4a6070", fontSize: 9 }}>{h}h</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function GeoChart() {
    const countries = {};
    logs.forEach(l => { if (l.country) countries[l.country] = (countries[l.country] || 0) + 1; });
    const entries = Object.entries(countries).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return (
      <div style={s.chartCard}>
        <div style={s.chartTitle}>🌍 Top Attack Origins</div>
        {entries.length === 0 ? <div style={s.noData}>No geo data yet</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {entries.map(([country, count], i) => (
              <div key={country} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#c8cad0", fontSize: 12 }}>#{i + 1} {country}</span>
                <span style={{ background: "rgba(255,136,0,0.15)", color: "#ff8800", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4 }}>{count} attacks</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function LiveThreatStats() {
    const recentLogs = logs.filter(l => {
      const d = new Date(l.timestamp);
      return Date.now() - d.getTime() < 24 * 60 * 60 * 1000;
    }).length;

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
        <div style={s.chartTitle}>📊 Live Threat Stats</div>
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

  const roleColor = (r) => ({ super_admin: "#ff8800", admin: "#00ff88", user: "#00aaff" }[r] || "#6b8090");

  return (
    <div style={s.shell}>
      {confirm && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={{ color: "#ff6060", fontSize: 16, fontWeight: 700, marginBottom: 8 }}>⚠️ Remove User</div>
            <p style={{ color: "#c8cad0", fontSize: 13, marginBottom: 20 }}>
              Permanently remove <b style={{ color: "#e8eaf0" }}>{confirm.username}</b>? This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button style={{ flex: 1, background: "rgba(255,68,68,0.2)", color: "#ff6060", border: "1px solid rgba(255,68,68,0.4)", borderRadius: 6, padding: 10, cursor: "pointer", fontWeight: 700 }}
                onClick={() => handleDeleteUser(confirm)}>Remove</button>
              <button style={{ flex: 1, background: "transparent", color: "#6b8090", border: "1px solid #1e3040", borderRadius: 6, padding: 10, cursor: "pointer" }}
                onClick={() => setConfirm(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div style={s.topbar}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 22 }}>🛡️</span>
          <div>
            <div style={s.pageTitle}>SOC Dashboard</div>
            <div style={s.pageSub}>Security Operations Center · Real-time Monitoring · Auto-refresh 30s</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={s.liveIndicator}><span style={s.liveDot} />LIVE</div>
          <span style={s.userChip}>{user?.username || "Admin"}</span>
          <button style={s.refreshBtn} onClick={load}>↺ Refresh</button>
          <button style={s.logoutBtn} onClick={onLogout}>Logout</button>
        </div>
      </div>

      <div style={s.tabs}>
        {TABS.map((t) => (
          <button key={t} style={{ ...s.tab, ...(tab === t ? s.tabActive : {}) }} onClick={() => setTab(t)}>
            {t === "dashboard" ? "📡 Dashboard"
              : t === "logs" ? `📋 Logs (${logs.length})`
              : t === "ips" ? `🚫 Blocked (${blockedIPs.length})`
              : t === "users" ? `👥 Users (${users.length})`
              : t === "invites" ? "🔐 Admin Invites"
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
          <div style={s.empty}>⏳ Loading security data...</div>
        ) : tab === "dashboard" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              {[
                { icon: "🎯", label: "AI Accuracy", value: `${metrics?.accuracy || 0}%`, color: "#00ff88" },
                { icon: "🚨", label: "Total Threats", value: metrics?.total_detections || 0, color: "#ff4444" },
                { icon: "🚫", label: "IPs Blocked", value: metrics?.blocked || 0, color: "#ff8800" },
                { icon: "⚡", label: "Avg Latency", value: `${metrics?.avg_latency_ms || 0}ms`, color: "#00aaff" },
              ].map(stat => (
                <div key={stat.label} style={{ background: "#0d1117", border: `1px solid ${stat.color}22`, borderRadius: 10, padding: "16px 20px" }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{stat.icon}</div>
                  <div style={{ color: stat.color, fontSize: 24, fontWeight: 700, fontFamily: "'Share Tech Mono', monospace" }}>{stat.value}</div>
                  <div style={{ color: "#4a6070", fontSize: 11, marginTop: 4, fontWeight: 600 }}>{stat.label}</div>
                </div>
              ))}
            </div>
            <ThreatMap logs={attackMap.length > 0 ? attackMap : logs} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <AttackTypeChart />
              <LiveThreatStats />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <TimelineChart />
              <GeoChart />
            </div>
            <div style={s.card}>
              <div style={s.cardTitle}>🚨 Recent Alerts</div>
              {logs.length === 0 ? (
                <div style={{ color: "#4a6070", fontSize: 13, marginTop: 10 }}>No alerts yet</div>
              ) : logs.slice(0, 5).map((l, i) => (
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

        ) : tab === "logs" ? (
          <div style={{ ...s.tableWrap, maxHeight: "70vh", overflowY: "auto" }}>
            <table style={s.table}>
              <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                <tr>{["Time", "IP Address", "Attack Type", "Confidence", "Location", "Blocked", "TX Hash"].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={7} style={{ ...s.td, textAlign: "center", color: "#4a6070" }}>No security logs yet</td></tr>
                ) : logs.map((l, i) => (
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
                <input style={{ ...s.input, flex: 1 }} placeholder="e.g. 192.168.1.100"
                  value={ipInput} onChange={(e) => setIpInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleBlock()} />
                <button style={s.blockBtn} onClick={handleBlock}>🚫 Block</button>
              </div>
            </div>
            <div style={s.card}>
              <div style={s.cardTitle}>Blocked IPs ({blockedIPs.length})</div>
              {blockedIPs.length === 0 ? <div style={{ color: "#4a6070", fontSize: 13, marginTop: 10 }}>No IPs currently blocked</div>
                : blockedIPs.map((entry, i) => (
                  <div key={i} style={s.ipRow}>
                    <div>
                      <span style={{ fontFamily: "monospace", color: "#e8eaf0", fontSize: 13 }}>{entry.ip}</span>
                      <span style={{ color: "#4a6070", fontSize: 11, marginLeft: 12 }}>{entry.reason} · by {entry.blocked_by}</span>
                    </div>
                    <button style={s.unblockBtn} onClick={() => handleUnblock(entry.ip)}>Unblock</button>
                  </div>
                ))}
            </div>
          </div>

        ) : tab === "users" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Admins Table */}
            <div style={s.card}>
              <div style={{ ...s.cardTitle, fontSize: 14, color: "#e8eaf0", marginBottom: 14 }}>
                🔐 Admins ({users.filter(u => u.role === "admin").length})
              </div>
              <div style={{ overflowX: "auto", maxHeight: "35vh", overflowY: "auto" }}>
                <table style={s.table}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                    <tr>{["#", "Username", "Email", "Face ID", "Created", "Action"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {users.filter(u => u.role === "admin").length === 0
                      ? <tr><td colSpan={6} style={{ ...s.td, textAlign: "center", color: "#4a6070" }}>No admins found</td></tr>
                      : users.filter(u => u.role === "admin").map((u, i) => (
                        <tr key={u.id} style={{ borderBottom: "1px solid #0d1520" }}>
                          <td style={{ ...s.td, color: "#4a6070", fontSize: 11 }}>{i + 1}</td>
                          <td style={{ ...s.td, fontWeight: 700, color: "#00ff88" }}>{u.username}</td>
                          <td style={{ ...s.td, color: "#6b8090", fontSize: 12 }}>{u.email}</td>
                          <td style={{ ...s.td, textAlign: "center" }}>{u.has_face ? "✅" : "❌"}</td>
                          <td style={{ ...s.td, color: "#6b8090", fontSize: 11 }}>{u.created_at && u.created_at !== "None" ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
                          <td style={s.td}>
                            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#4a6070" }}>
                              🔒 Protected
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Users Table */}
            <div style={s.card}>
              <div style={{ ...s.cardTitle, fontSize: 14, color: "#e8eaf0", marginBottom: 14 }}>
                👤 Users ({users.filter(u => u.role === "user").length})
              </div>
              <div style={{ overflowX: "auto", maxHeight: "35vh", overflowY: "auto" }}>
                <table style={s.table}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                    <tr>{["#", "Username", "Email", "Face ID", "Created", "Action"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {users.filter(u => u.role === "user").length === 0
                      ? <tr><td colSpan={6} style={{ ...s.td, textAlign: "center", color: "#4a6070" }}>No users found</td></tr>
                      : users.filter(u => u.role === "user").map((u, i) => (
                        <tr key={u.id} style={{ borderBottom: "1px solid #0d1520" }}>
                          <td style={{ ...s.td, color: "#4a6070", fontSize: 11 }}>{i + 1}</td>
                          <td style={{ ...s.td, fontWeight: 700, color: "#00aaff" }}>{u.username}</td>
                          <td style={{ ...s.td, color: "#6b8090", fontSize: 12 }}>{u.email}</td>
                          <td style={{ ...s.td, textAlign: "center" }}>{u.has_face ? "✅" : "❌"}</td>
                          <td style={{ ...s.td, color: "#6b8090", fontSize: 11 }}>{u.created_at && u.created_at !== "None" ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
                          <td style={s.td}>
                            <button style={{ background: "rgba(255,68,68,0.15)", color: "#ff6060", border: "1px solid rgba(255,68,68,0.4)", borderRadius: 6, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
                              onClick={() => setConfirm(u)}>🗑 Remove</button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        ) : tab === "messages" ? (
          <Messaging user={user} />

        ) : tab === "invites" ? (
          <InvitePanel />

        ) : tab === "metrics" ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <AttackTypeChart />
            <LiveThreatStats />
            <TimelineChart />
            <GeoChart />
          </div>
        ) : null}
      </div>
    </div>
  );
}

const s = {
  shell: { display: "flex", flexDirection: "column", height: "100vh", background: "#060a0f", color: "#e8eaf0", fontFamily: "'Inter', sans-serif", overflow: "hidden" },
  topbar: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 24px", borderBottom: "1px solid #1e3040", background: "#080c12", flexShrink: 0 },
  pageTitle: { fontSize: 16, fontWeight: 700, color: "#e8eaf0" },
  pageSub: { fontSize: 10, color: "#4a6070", marginTop: 2 },
  liveIndicator: { display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 700, color: "#00ff88", letterSpacing: "0.1em" },
  liveDot: { width: 6, height: 6, borderRadius: "50%", background: "#00ff88", display: "inline-block", animation: "pulse 1.5s infinite" },
  userChip: { background: "rgba(0,170,255,0.1)", color: "#00aaff", border: "1px solid rgba(0,170,255,0.3)", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 600 },
  refreshBtn: { background: "rgba(0,255,136,0.1)", color: "#00ff88", border: "1px solid rgba(0,255,136,0.3)", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600 },
  logoutBtn: { background: "rgba(255,68,68,0.1)", color: "#ff6060", border: "1px solid rgba(255,68,68,0.3)", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600 },
  tabs: { display: "flex", gap: 4, padding: "8px 24px", borderBottom: "1px solid #1e3040", background: "#080c12", flexShrink: 0, flexWrap: "wrap" },
  tab: { background: "transparent", color: "#6b8090", border: "1px solid transparent", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600, transition: "all 0.2s" },
  tabActive: { background: "rgba(0,255,136,0.1)", color: "#00ff88", border: "1px solid rgba(0,255,136,0.3)" },
  body: { flex: 1, overflowY: "auto", overflowX: "hidden", padding: "20px 24px", maxHeight: "calc(100vh - 112px)" },
  empty: { textAlign: "center", color: "#4a6070", fontSize: 14, marginTop: 60 },
  card: { background: "#0d1117", border: "1px solid #1e3040", borderRadius: 10, padding: "16px 20px" },
  cardTitle: { fontSize: 13, fontWeight: 700, color: "#6b8090", letterSpacing: "0.05em", marginBottom: 4 },
  chartCard: { background: "#0d1117", border: "1px solid #1e3040", borderRadius: 10, padding: "16px 20px" },
  chartTitle: { fontSize: 12, fontWeight: 700, color: "#6b8090", letterSpacing: "0.08em" },
  noData: { color: "#4a6070", fontSize: 12, marginTop: 12 },
  tableWrap: { background: "#0d1117", border: "1px solid #1e3040", borderRadius: 10, overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse", tableLayout: "fixed" },
  th: { background: "#080c10", color: "#6b8090", fontSize: 10, fontWeight: 700, padding: "10px 14px", textAlign: "left", letterSpacing: "0.08em", borderBottom: "1px solid #1e3040" },
  td: { padding: "10px 14px", fontSize: 12, color: "#c8cad0" },
  input: { background: "#080c10", border: "1px solid #1e3040", borderRadius: 6, padding: "8px 12px", color: "#e8eaf0", fontSize: 13, outline: "none" },
  blockBtn: { background: "rgba(255,68,68,0.15)", color: "#ff6060", border: "1px solid rgba(255,68,68,0.3)", borderRadius: 6, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600 },
  unblockBtn: { background: "rgba(0,255,136,0.1)", color: "#00ff88", border: "1px solid rgba(0,255,136,0.3)", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 11 },
  ipRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #0d1520" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modal: { background: "#0d1117", border: "1px solid #1e3040", borderRadius: 12, padding: 24, width: 340 },
};