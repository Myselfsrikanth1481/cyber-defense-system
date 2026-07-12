import { useState, useEffect } from "react";
import { useAuth } from "./hooks/useAuth";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AdminRegister from "./pages/AdminRegister";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import AdminSOC from "./pages/AdminSOC";
import Vault from "./pages/Vault";
import Messaging from "./pages/Messaging";
import BlockchainLedger from "./pages/BlockchainLedger";

const BASE_URL = "https://cyber-defense-system-1422.onrender.com";
function getToken() { return localStorage.getItem("token"); }

async function callLogout() {
  try {
    await fetch(`${BASE_URL}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
  } catch (_) {}
}

export default function App() {
  const { user, loading, logout, saveToken } = useAuth();
  const [screen, setScreen] = useState("login");
  const [view, setView] = useState("dashboard");
  const [unread, setUnread] = useState(0);

  const isAdminRegisterPage = window.location.pathname === "/admin-register";
  if (isAdminRegisterPage) return <AdminRegister />;

  useEffect(() => {
    if (user?.role === "admin") setView("soc");
    if (user?.role === "super_admin") setView("dashboard");
  }, [user]);

  useEffect(() => {
    if (!user || !["admin", "super_admin"].includes(user.role)) return;
    const fetchUnread = async () => {
      try {
        const res = await fetch(`${BASE_URL}/documents/unread-total`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (res.ok) { const data = await res.json(); setUnread(data.unread || 0); }
      } catch (_) {}
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 5000);
    return () => clearInterval(interval);
  }, [user]);

  const handleLogout = async () => {
    await callLogout();
    logout();
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#080c10", display: "flex", alignItems: "center", justifyContent: "center", color: "#00ff88", fontFamily: "'Share Tech Mono', monospace", fontSize: 14 }}>
        Initializing secure session...
      </div>
    );
  }

  if (!user) {
    if (screen === "register") return <Register onSwitch={() => setScreen("login")} />;
    return <Login onSwitch={() => setScreen("register")} saveToken={saveToken} />;
  }

  if (user.role === "super_admin") {
    return (
      <div>
        <div style={pill}>
          {["dashboard", "messages", "ledger"].map(v => (
            <button key={v} onClick={() => setView(v)} style={pillBtn(view === v)}>
              {v === "dashboard" ? "👑 Dashboard"
                : v === "ledger" ? "⛓ Ledger"
                : (
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    💬 Messages {unread > 0 && <span style={badge}>{unread}</span>}
                  </span>
                )}
            </button>
          ))}
          <button onClick={handleLogout} style={{ ...pillBtn(false), color: "#ff6060" }}>Logout</button>
        </div>
        {view === "dashboard" && <SuperAdminDashboard user={user} onLogout={handleLogout} />}
        {view === "messages" && <Messaging user={user} />}
        {view === "ledger" && <BlockchainLedger user={user} />}
      </div>
    );
  }

  if (user.role === "admin") {
    return (
      <div>
        <div style={pill}>
          {["soc", "vault", "messages", "ledger"].map(v => (
            <button key={v} onClick={() => setView(v)} style={pillBtn(view === v)}>
              {v === "soc" ? "🛡 SOC"
                : v === "vault" ? "🔒 Vault"
                : v === "ledger" ? "⛓ Ledger"
                : (
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    💬 Messages {unread > 0 && <span style={badge}>{unread}</span>}
                  </span>
                )}
            </button>
          ))}
          <button onClick={handleLogout} style={{ ...pillBtn(false), color: "#ff6060" }}>Logout</button>
        </div>
        {view === "soc" && <AdminSOC user={user} onLogout={handleLogout} />}
        {view === "vault" && <Vault user={user} onLogout={handleLogout} />}
        {view === "messages" && <Messaging user={user} />}
        {view === "ledger" && <BlockchainLedger user={user} />}
      </div>
    );
  }

  return <Vault user={user} onLogout={handleLogout} />;
}

const pill = {
  position: "fixed", bottom: 20, right: 20, zIndex: 999,
  display: "flex", background: "#0d1117",
  border: "1px solid #1e3040", borderRadius: 30, overflow: "hidden",
};

const pillBtn = (active) => ({
  padding: "8px 16px", border: "none",
  background: active ? "#00ff88" : "transparent",
  color: active ? "#080c10" : "#6b8090",
  fontSize: 12, fontWeight: 700, cursor: "pointer",
  fontFamily: "'Exo 2', sans-serif", letterSpacing: "0.05em",
  display: "flex", alignItems: "center", gap: 4,
});

const badge = {
  background: "#ff4444", color: "#fff",
  borderRadius: 10, fontSize: 10, fontWeight: 700,
  padding: "1px 5px",
};
