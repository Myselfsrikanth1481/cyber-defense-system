import { useState, useEffect } from "react";

const BASE_URL = "http://localhost:8000";
function getToken() { return localStorage.getItem("token"); }

export default function BlockchainLedger({ user }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetchLedger();
    const interval = setInterval(fetchLedger, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchLedger = async () => {
    try {
      const res = await fetch(`${BASE_URL}/documents/blockchain-ledger`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Failed to fetch ledger");
      const data = await res.json();
      setTransactions(data);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const roleColor = (role) => {
    if (role === "super_admin") return "#ff9900";
    if (role === "admin") return "#00aaff";
    return "#00ff88";
  };

  const roleLabel = (role) => {
    if (role === "super_admin") return "SUPER ADMIN";
    if (role === "admin") return "ADMIN";
    return "USER";
  };

  const filtered = transactions.filter(tx => {
    const matchSearch =
      tx.filename?.toLowerCase().includes(search.toLowerCase()) ||
      tx.sender_username?.toLowerCase().includes(search.toLowerCase()) ||
      tx.receiver_username?.toLowerCase().includes(search.toLowerCase()) ||
      tx.tx_hash?.toLowerCase().includes(search.toLowerCase());

    if (filter === "all") return matchSearch;
    if (filter === "sent") return matchSearch && tx.sender_id === user?.id;
    if (filter === "received") return matchSearch && tx.receiver_id === user?.id;
    if (filter === "admin") return matchSearch && (tx.sender_role === "admin" || tx.receiver_role === "admin");
    if (filter === "super_admin") return matchSearch && (tx.sender_role === "super_admin" || tx.receiver_role === "super_admin");
    return matchSearch;
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleString();
  };

  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const shortHash = (hash) => {
    if (!hash) return "—";
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
  };

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.chainIcon}>⛓️</div>
          <div>
            <div style={styles.title}>Blockchain Ledger</div>
            <div style={styles.subtitle}>
              Immutable document transaction log · {transactions.length} records
            </div>
          </div>
        </div>
        <button onClick={fetchLedger} style={styles.refreshBtn}>
          🔄 Refresh
        </button>
      </div>

      {/* Stats Bar */}
      <div style={styles.statsBar}>
        {[
          { label: "Total Transactions", value: transactions.length, color: "#00ff88" },
          { label: "Sent by Me", value: transactions.filter(t => t.sender_id === user?.id).length, color: "#00aaff" },
          { label: "Received by Me", value: transactions.filter(t => t.receiver_id === user?.id).length, color: "#ff9900" },
          { label: "Live Chain", value: transactions.filter(t => t.chain_mode === "live").length, color: "#aa44ff" },
          { label: "Mock Chain", value: transactions.filter(t => t.chain_mode === "mock").length, color: "#6b8090" },
        ].map(s => (
          <div key={s.label} style={styles.statCard}>
            <div style={{ ...styles.statValue, color: s.color }}>{s.value}</div>
            <div style={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={styles.filterBar}>
        <input
          placeholder="🔍  Search filename, user, tx hash..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={styles.searchInput}
        />
        <div style={styles.filterBtns}>
          {["all", "sent", "received", "admin", "super_admin"].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                ...styles.filterBtn,
                background: filter === f ? "#00ff88" : "transparent",
                color: filter === f ? "#080c10" : "#6b8090",
                borderColor: filter === f ? "#00ff88" : "#1e3040",
              }}
            >
              {f === "all" ? "All" :
               f === "sent" ? "Sent by Me" :
               f === "received" ? "Received by Me" :
               f === "admin" ? "Admin" : "Super Admin"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={styles.center}>⏳ Loading blockchain ledger...</div>
      ) : error ? (
        <div style={styles.errorBox}>⚠️ {error}</div>
      ) : filtered.length === 0 ? (
        <div style={styles.center}>No transactions found.</div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {["#", "Document", "Size", "From", "To", "Message", "Tx Hash", "Block", "Chain", "Date & Time"].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((tx, i) => {
                const isMe = tx.sender_id === user?.id || tx.receiver_id === user?.id;
                return (
                  <tr
                    key={tx.id}
                    style={{
                      ...styles.tr,
                      background: isMe ? "rgba(0,255,136,0.04)" : "transparent",
                    }}
                  >
                    <td style={styles.td}>{i + 1}</td>

                    {/* Document */}
                    <td style={styles.td}>
                      <div style={styles.filename}>
                        {tx.filename === "(message only)" ? (
                          <span style={{ color: "#6b8090", fontStyle: "italic" }}>Message only</span>
                        ) : (
                          <>📄 {tx.filename}</>
                        )}
                      </div>
                    </td>

                    {/* Size */}
                    <td style={{ ...styles.td, color: "#6b8090" }}>
                      {formatSize(tx.file_size)}
                    </td>

                    {/* From */}
                    <td style={styles.td}>
                      <div style={styles.userCell}>
                        <div style={{ ...styles.roleTag, borderColor: roleColor(tx.sender_role), color: roleColor(tx.sender_role) }}>
                          {roleLabel(tx.sender_role)}
                        </div>
                        <div style={styles.username}>
                          {tx.sender_username}
                          {tx.sender_id === user?.id && <span style={styles.meTag}> (me)</span>}
                        </div>
                      </div>
                    </td>

                    {/* To */}
                    <td style={styles.td}>
                      <div style={styles.userCell}>
                        <div style={{ ...styles.roleTag, borderColor: roleColor(tx.receiver_role), color: roleColor(tx.receiver_role) }}>
                          {roleLabel(tx.receiver_role)}
                        </div>
                        <div style={styles.username}>
                          {tx.receiver_username}
                          {tx.receiver_id === user?.id && <span style={styles.meTag}> (me)</span>}
                        </div>
                      </div>
                    </td>

                    {/* Message */}
                    <td style={{ ...styles.td, maxWidth: 160 }}>
                      <div style={styles.msgPreview}>
                        {tx.message_preview || <span style={{ color: "#6b8090" }}>—</span>}
                      </div>
                    </td>

                    {/* Tx Hash */}
                    <td style={styles.td}>
                      <div
                        style={styles.txHash}
                        title={tx.tx_hash}
                        onClick={() => tx.tx_hash && navigator.clipboard.writeText(tx.tx_hash)}
                      >
                        {shortHash(tx.tx_hash)}
                        {tx.tx_hash && <span style={styles.copyHint}> 📋</span>}
                      </div>
                    </td>

                    {/* Block */}
                    <td style={{ ...styles.td, color: "#aa44ff", fontFamily: "monospace" }}>
                      {tx.block_number ? `#${tx.block_number}` : "—"}
                    </td>

                    {/* Chain Mode */}
                    <td style={styles.td}>
                      <span style={{
                        ...styles.chainBadge,
                        background: tx.chain_mode === "live" ? "rgba(0,255,136,0.15)" : "rgba(107,128,144,0.15)",
                        color: tx.chain_mode === "live" ? "#00ff88" : "#6b8090",
                        borderColor: tx.chain_mode === "live" ? "#00ff88" : "#3a4a5a",
                      }}>
                        {tx.chain_mode === "live" ? "⛓ LIVE" : "🔲 MOCK"}
                      </span>
                    </td>

                    {/* Date */}
                    <td style={{ ...styles.td, color: "#6b8090", whiteSpace: "nowrap", fontSize: 11 }}>
                      {formatDate(tx.sent_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#080c10",
    padding: "24px",
    fontFamily: "'Exo 2', sans-serif",
    color: "#c9d8e0",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: "1px solid #1e3040",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  chainIcon: {
    fontSize: 36,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: "#00ff88",
    letterSpacing: "0.05em",
  },
  subtitle: {
    fontSize: 12,
    color: "#6b8090",
    marginTop: 2,
  },
  refreshBtn: {
    padding: "8px 16px",
    background: "transparent",
    border: "1px solid #1e3040",
    borderRadius: 8,
    color: "#00ff88",
    cursor: "pointer",
    fontSize: 12,
    fontFamily: "'Exo 2', sans-serif",
  },
  statsBar: {
    display: "flex",
    gap: 12,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  statCard: {
    flex: 1,
    minWidth: 120,
    background: "#0d1117",
    border: "1px solid #1e3040",
    borderRadius: 10,
    padding: "12px 16px",
    textAlign: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: 700,
    fontFamily: "'Share Tech Mono', monospace",
  },
  statLabel: {
    fontSize: 10,
    color: "#6b8090",
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  filterBar: {
    display: "flex",
    gap: 12,
    marginBottom: 20,
    flexWrap: "wrap",
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    minWidth: 240,
    background: "#0d1117",
    border: "1px solid #1e3040",
    borderRadius: 8,
    padding: "8px 14px",
    color: "#c9d8e0",
    fontSize: 13,
    fontFamily: "'Exo 2', sans-serif",
    outline: "none",
  },
  filterBtns: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  },
  filterBtn: {
    padding: "6px 14px",
    border: "1px solid",
    borderRadius: 20,
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 700,
    fontFamily: "'Exo 2', sans-serif",
    letterSpacing: "0.04em",
  },
  tableWrap: {
    overflowX: "auto",
    border: "1px solid #1e3040",
    borderRadius: 12,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 12,
  },
  th: {
    padding: "12px 14px",
    textAlign: "left",
    background: "#0d1117",
    color: "#6b8090",
    fontWeight: 700,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    borderBottom: "1px solid #1e3040",
    whiteSpace: "nowrap",
  },
  tr: {
    borderBottom: "1px solid #111820",
    transition: "background 0.15s",
  },
  td: {
    padding: "10px 14px",
    verticalAlign: "middle",
    color: "#c9d8e0",
  },
  filename: {
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 12,
    color: "#00ff88",
    whiteSpace: "nowrap",
  },
  userCell: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },
  roleTag: {
    fontSize: 9,
    fontWeight: 700,
    border: "1px solid",
    borderRadius: 4,
    padding: "1px 5px",
    display: "inline-block",
    letterSpacing: "0.05em",
    width: "fit-content",
  },
  username: {
    fontSize: 12,
    fontWeight: 600,
    color: "#c9d8e0",
  },
  meTag: {
    color: "#00ff88",
    fontSize: 10,
    fontWeight: 700,
  },
  msgPreview: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 150,
    color: "#8a9fb0",
    fontSize: 11,
  },
  txHash: {
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 11,
    color: "#aa44ff",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  copyHint: {
    fontSize: 10,
    opacity: 0.6,
  },
  chainBadge: {
    border: "1px solid",
    borderRadius: 6,
    padding: "2px 8px",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.05em",
    whiteSpace: "nowrap",
  },
  center: {
    textAlign: "center",
    padding: 60,
    color: "#6b8090",
    fontSize: 14,
  },
  errorBox: {
    background: "rgba(255,68,68,0.1)",
    border: "1px solid #ff4444",
    borderRadius: 10,
    padding: 20,
    color: "#ff6060",
    textAlign: "center",
  },
};