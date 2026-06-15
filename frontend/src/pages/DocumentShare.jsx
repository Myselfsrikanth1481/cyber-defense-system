import { useEffect, useState, useRef } from "react";
import {
  getContacts, sendDocument, getConversation,
  downloadSharedDoc, deleteSharedDoc, markAsRead,
} from "../api";

export default function DocumentShare({ user }) {
  const [tab, setTab] = useState("inbox");
  const [inbox, setInbox] = useState([]);
  const [sent, setSent] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [message, setMessage] = useState("");
  const [file, setFile] = useState(null);
  const [sendError, setSendError] = useState("");
  const [sendSuccess, setSendSuccess] = useState("");
  const fileRef = useRef();

  async function load() {
    setLoading(true);
    try {
      const c = await getContacts();
      const contactList = Array.isArray(c) ? c : [];
      setContacts(contactList);

      const allInbox = [];
      const allSent = [];
      for (const contact of contactList) {
        try {
          const msgs = await getConversation(contact.id);
          if (Array.isArray(msgs)) {
            msgs.forEach(doc => {
              if (doc.sender_id === user?.id) allSent.push(doc);
              else allInbox.push(doc);
            });
          }
        } catch (_) {}
      }
      setInbox(allInbox);
      setSent(allSent);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleSend() {
    if (!selectedContact) { setSendError("Please select a recipient"); return; }
    if (!file) { setSendError("Please select a file to send"); return; }
    setSendError("");
    setSending(true);
    try {
      await sendDocument(selectedContact.id, message, file);
      setSendSuccess(`Document sent to ${selectedContact.username} successfully!`);
      setFile(null);
      setMessage("");
      setSelectedContact(null);
      if (fileRef.current) fileRef.current.value = "";
      load();
      setTimeout(() => { setSendSuccess(""); setTab("sent"); }, 2000);
    } catch (e) {
      setSendError(e.message);
    } finally {
      setSending(false);
    }
  }

  async function handleDownload(doc) {
    try {
      await downloadSharedDoc(doc.id, doc.filename);
      if (!doc.is_read) {
        await markAsRead(doc.id);
        load();
      }
    } catch (e) { alert(e.message); }
  }

  async function handleDelete(doc) {
    if (!window.confirm(`Delete "${doc.filename}"?`)) return;
    try { await deleteSharedDoc(doc.id); load(); }
    catch (e) { alert(e.message); }
  }

  function formatSize(bytes) {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function fileIcon(name) {
    const ext = (name || "").split(".").pop().toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "🖼️";
    if (["pdf"].includes(ext)) return "📄";
    if (["zip", "rar", "tar"].includes(ext)) return "📦";
    if (["doc", "docx"].includes(ext)) return "📝";
    if (["xls", "xlsx"].includes(ext)) return "📊";
    if (["mp4", "mov", "avi"].includes(ext)) return "🎥";
    if (["txt"].includes(ext)) return "📃";
    return "📁";
  }

  const roleColor = (r) => ({ super_admin: "#ff8800", admin: "#00ff88" }[r] || "#6b8090");
  const unreadCount = inbox.filter(d => !d.is_read).length;

  return (
    <div style={s.shell}>
      <div style={s.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>📨</span>
          <div>
            <div style={s.headerTitle}>Secure Document Sharing</div>
            <div style={s.headerSub}>End-to-end encrypted · Admins only</div>
          </div>
        </div>
        <button style={s.composeBtn} onClick={() => setTab("compose")}>
          ✉️ Send Document
        </button>
      </div>

      <div style={s.tabs}>
        {[
          { key: "inbox", label: `📥 Inbox${unreadCount > 0 ? ` (${unreadCount} new)` : ` (${inbox.length})`}` },
          { key: "sent", label: `📤 Sent (${sent.length})` },
          { key: "compose", label: "✉️ Compose" },
        ].map(t => (
          <button key={t.key} style={{ ...s.tab, ...(tab === t.key ? s.tabActive : {}) }}
            onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={s.body}>
        {loading ? (
          <div style={s.empty}>Loading...</div>
        ) : tab === "inbox" ? (
          <div style={s.list}>
            {inbox.length === 0 ? (
              <div style={s.emptyBox}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
                <div>Your inbox is empty</div>
              </div>
            ) : inbox.map(doc => (
              <div key={doc.id} style={{ ...s.docCard, borderLeft: doc.is_read ? "3px solid #1e3040" : "3px solid #00ff88" }}>
                <div style={s.docIcon}>{fileIcon(doc.filename)}</div>
                <div style={s.docInfo}>
                  <div style={s.docName}>
                    {doc.filename}
                    {!doc.is_read && <span style={s.newBadge}>NEW</span>}
                  </div>
                  <div style={s.docMeta}>
                    From: <span style={{ color: "#00ff88" }}>{doc.sender_username}</span>
                    &nbsp;·&nbsp;{formatSize(doc.file_size)}
                    &nbsp;·&nbsp;{doc.created_at ? new Date(doc.created_at).toLocaleString() : "—"}
                  </div>
                  {doc.message && <div style={s.docMessage}>💬 {doc.message}</div>}
                </div>
                <div style={s.docActions}>
                  <button style={s.dlBtn} onClick={() => handleDownload(doc)}>⬇️ Download</button>
                  <button style={s.delBtn} onClick={() => handleDelete(doc)}>🗑</button>
                </div>
              </div>
            ))}
          </div>

        ) : tab === "sent" ? (
          <div style={s.list}>
            {sent.length === 0 ? (
              <div style={s.emptyBox}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📤</div>
                <div>No documents sent yet</div>
              </div>
            ) : sent.map(doc => (
              <div key={doc.id} style={s.docCard}>
                <div style={s.docIcon}>{fileIcon(doc.filename)}</div>
                <div style={s.docInfo}>
                  <div style={s.docName}>{doc.filename}</div>
                  <div style={s.docMeta}>
                    To: <span style={{ color: "#00aaff" }}>{doc.receiver_username}</span>
                    &nbsp;·&nbsp;{formatSize(doc.file_size)}
                    &nbsp;·&nbsp;{doc.created_at ? new Date(doc.created_at).toLocaleString() : "—"}
                    &nbsp;·&nbsp;
                    <span style={{ color: doc.is_read ? "#00ff88" : "#6b8090" }}>
                      {doc.is_read ? "✅ Read" : "⏳ Unread"}
                    </span>
                  </div>
                  {doc.message && <div style={s.docMessage}>💬 {doc.message}</div>}
                </div>
                <div style={s.docActions}>
                  <button style={s.delBtn} onClick={() => handleDelete(doc)}>🗑</button>
                </div>
              </div>
            ))}
          </div>

        ) : (
          <div style={s.composeCard}>
            <div style={s.composeTitle}>📨 Send Secure Document</div>

            {sendSuccess && <div style={s.success}>✅ {sendSuccess}</div>}
            {sendError && <div style={s.error}>⚠️ {sendError}</div>}

            <div style={s.fieldWrap}>
              <label style={s.label}>SELECT RECIPIENT</label>
              <div style={s.contactList}>
                {contacts.length === 0 ? (
                  <div style={{ color: "#4a6070", fontSize: 12, padding: 12 }}>No other admins found</div>
                ) : contacts.map(c => (
                  <div
                    key={c.id}
                    style={{
                      ...s.contactRow,
                      background: selectedContact?.id === c.id ? "rgba(0,255,136,0.08)" : "transparent",
                      borderColor: selectedContact?.id === c.id ? "rgba(0,255,136,0.3)" : "#1e3040",
                    }}
                    onClick={() => setSelectedContact(c)}
                  >
                    <div style={s.contactAvatar}>
                      {c.role === "super_admin" ? "👑" : "🛡️"}
                    </div>
                    <div>
                      <div style={{ color: "#e8eaf0", fontSize: 13, fontWeight: 600 }}>{c.username}</div>
                      <div style={{ color: roleColor(c.role), fontSize: 10, fontWeight: 700, letterSpacing: "0.08em" }}>
                        {c.role?.toUpperCase().replace("_", " ")}
                      </div>
                    </div>
                    {selectedContact?.id === c.id && (
                      <span style={{ marginLeft: "auto", color: "#00ff88", fontSize: 16 }}>✓</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={s.fieldWrap}>
              <label style={s.label}>MESSAGE (OPTIONAL)</label>
              <textarea
                style={s.textarea}
                placeholder="Add a note about this document..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
              />
            </div>

            <div style={s.fieldWrap}>
              <label style={s.label}>SELECT FILE (MAX 10MB)</label>
              <label style={s.fileLabel}>
                {file
                  ? <span style={{ color: "#00ff88" }}>📎 {file.name} ({formatSize(file.size)})</span>
                  : <span>📎 Click to choose file</span>}
                <input
                  ref={fileRef}
                  type="file"
                  style={{ display: "none" }}
                  onChange={(e) => setFile(e.target.files[0])}
                />
              </label>
            </div>

            <button
              style={{ ...s.sendBtn, opacity: sending ? 0.7 : 1 }}
              onClick={handleSend}
              disabled={sending}
            >
              {sending ? "⏳ Sending..." : "📨 Send Document →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  shell: { background: "#080c10", fontFamily: "'Exo 2', sans-serif", color: "#e8eaf0", minHeight: "100%" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 28px", borderBottom: "1px solid #1e3040", background: "#0d1117" },
  headerTitle: { fontSize: 15, fontWeight: 700, color: "#e8eaf0" },
  headerSub: { fontSize: 11, color: "#4a6070", marginTop: 2 },
  composeBtn: { background: "linear-gradient(135deg, #00ff88, #00cc6a)", color: "#080c10", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  tabs: { display: "flex", borderBottom: "1px solid #1e3040", background: "#0d1117" },
  tab: { padding: "10px 20px", background: "transparent", border: "none", borderBottom: "2px solid transparent", color: "#6b8090", fontSize: 12, cursor: "pointer", fontFamily: "'Exo 2', sans-serif", whiteSpace: "nowrap" },
  tabActive: { color: "#00ff88", borderBottomColor: "#00ff88" },
  body: { padding: "20px 28px" },
  empty: { textAlign: "center", padding: "40px", color: "#4a6070" },
  emptyBox: { textAlign: "center", padding: "40px", color: "#4a6070", fontSize: 14 },
  list: { display: "flex", flexDirection: "column", gap: 10 },
  docCard: { display: "flex", alignItems: "center", gap: 14, background: "#0d1117", border: "1px solid #1e3040", borderRadius: 10, padding: "14px 18px" },
  docIcon: { fontSize: 28, flexShrink: 0 },
  docInfo: { flex: 1, minWidth: 0 },
  docName: { color: "#e8eaf0", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, marginBottom: 4 },
  docMeta: { color: "#4a6070", fontSize: 11 },
  docMessage: { color: "#6b8090", fontSize: 12, marginTop: 4, fontStyle: "italic" },
  docActions: { display: "flex", gap: 8, flexShrink: 0 },
  dlBtn: { background: "rgba(0,255,136,0.1)", color: "#00ff88", border: "1px solid rgba(0,255,136,0.2)", borderRadius: 6, padding: "6px 12px", fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" },
  delBtn: { background: "rgba(255,68,68,0.08)", color: "#ff6060", border: "1px solid rgba(255,68,68,0.2)", borderRadius: 6, padding: "6px 10px", fontSize: 12, cursor: "pointer" },
  newBadge: { background: "rgba(0,255,136,0.15)", color: "#00ff88", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, border: "1px solid rgba(0,255,136,0.3)", letterSpacing: "0.08em" },
  composeCard: { background: "#0d1117", border: "1px solid #1e3040", borderRadius: 12, padding: "24px 28px", maxWidth: 600, display: "flex", flexDirection: "column", gap: 18 },
  composeTitle: { color: "#e8eaf0", fontSize: 15, fontWeight: 700 },
  success: { background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.3)", borderRadius: 8, padding: "10px 14px", color: "#00ff88", fontSize: 12 },
  error: { background: "rgba(255,60,60,0.08)", border: "1px solid rgba(255,60,60,0.3)", borderRadius: 8, padding: "10px 14px", color: "#ff6060", fontSize: 12 },
  fieldWrap: { display: "flex", flexDirection: "column", gap: 8 },
  label: { color: "#4a6070", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em" },
  contactList: { background: "#111820", border: "1px solid #1e3040", borderRadius: 8, overflow: "hidden", maxHeight: 200, overflowY: "auto" },
  contactRow: { display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", cursor: "pointer", border: "1px solid transparent", transition: "all 0.15s" },
  contactAvatar: { fontSize: 20, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "#0d1117", borderRadius: "50%", border: "1px solid #1e3040" },
  textarea: { background: "#111820", border: "1px solid #1e3040", borderRadius: 8, padding: "10px 12px", color: "#e8eaf0", fontSize: 13, outline: "none", fontFamily: "'Exo 2', sans-serif", resize: "vertical", width: "100%", boxSizing: "border-box" },
  fileLabel: { display: "flex", alignItems: "center", justifyContent: "center", padding: "14px", background: "#111820", border: "1.5px dashed #1e3040", borderRadius: 8, color: "#6b8090", fontSize: 12, cursor: "pointer", textAlign: "center" },
  sendBtn: { background: "linear-gradient(135deg, #00ff88, #00cc6a)", color: "#080c10", border: "none", borderRadius: 8, padding: "13px", fontSize: 13, fontWeight: 700, cursor: "pointer", width: "100%" },
};