import { useState, useEffect, useRef, useCallback } from "react";

const BASE_URL = "http://localhost:8000";
function getToken() { return localStorage.getItem("token"); }
function authH() { return { Authorization: `Bearer ${getToken()}` }; }

function fmtSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function fileIcon(name) {
  if (!name) return "💬";
  const ext = name.split(".").pop()?.toLowerCase();
  const map = {
    pdf: "📄", doc: "📝", docx: "📝", xls: "📊", xlsx: "📊",
    ppt: "📋", pptx: "📋", zip: "🗜️", rar: "🗜️",
    jpg: "🖼️", jpeg: "🖼️", png: "🖼️", gif: "🖼️",
    mp4: "🎬", mp3: "🎵", txt: "📃",
  };
  return map[ext] || "📎";
}

async function apiGet(path) {
  const r = await fetch(`${BASE_URL}${path}`, { headers: authH() });
  if (!r.ok) throw new Error((await r.json()).detail || "Error");
  return r.json();
}

export default function Messaging({ user }) {
  const [contacts, setContacts]     = useState([]);
  const [active, setActive]         = useState(null);
  const [thread, setThread]         = useState([]);
  const [file, setFile]             = useState(null);
  const [message, setMessage]       = useState("");
  const [sending, setSending]       = useState(false);
  const [loadingThread, setLT]      = useState(false);
  const [error, setError]           = useState("");
  const [search, setSearch]         = useState("");
  const [dragging, setDragging]     = useState(false);
  const [showBroadcast, setBroadcast] = useState(false);
  const [bcReceivers, setBcReceivers] = useState([]);
  const [bcMessage, setBcMessage]   = useState("");
  const [bcFile, setBcFile]         = useState(null);
  const [bcSending, setBcSending]   = useState(false);

  const fileRef    = useRef();
  const bcFileRef  = useRef();
  const bottomRef  = useRef();
  const pollRef    = useRef();

  // ── load contacts with unread counts ──────────────────────────────────────
  const loadContacts = useCallback(async () => {
    try {
      const data = await apiGet("/documents/contacts");
      setContacts(data);
    } catch (e) { console.error(e); }
  }, []);

  // ── load thread ───────────────────────────────────────────────────────────
  const loadThread = useCallback(async (contactId) => {
    if (!contactId) return;
    setLT(true);
    try {
      const data = await apiGet(`/documents/conversation/${contactId}`);
      setThread(data);
    } catch (e) { setError(e.message); }
    finally { setLT(false); }
  }, []);

  useEffect(() => { loadContacts(); }, []);

  // auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  // poll every 4s
  useEffect(() => {
    pollRef.current = setInterval(() => {
      loadContacts();
      if (active) loadThread(active.id);
    }, 4000);
    return () => clearInterval(pollRef.current);
  }, [active, loadThread, loadContacts]);

  // ── select contact ────────────────────────────────────────────────────────
  async function selectContact(c) {
    setActive(c);
    setError("");
    setFile(null);
    setMessage("");
    setBroadcast(false);
    await loadThread(c.id);
  }

  // ── send ──────────────────────────────────────────────────────────────────
  async function handleSend() {
    if (!active) return;
    if (!file && !message.trim()) return;
    setSending(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("receiver_id", active.id);
      if (message.trim()) fd.append("message", message.trim());
      if (file) fd.append("file", file);
      const r = await fetch(`${BASE_URL}/documents/send`, {
        method: "POST", headers: authH(), body: fd,
      });
      if (!r.ok) throw new Error((await r.json()).detail || "Send failed");
      setFile(null);
      setMessage("");
      await loadThread(active.id);
      await loadContacts();
    } catch (e) { setError(e.message); }
    finally { setSending(false); }
  }

  // ── broadcast ─────────────────────────────────────────────────────────────
  async function handleBroadcast() {
    if (!bcMessage.trim() && !bcFile) return;
    if (bcReceivers.length === 0) { setError("Select at least one recipient"); return; }
    setBcSending(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("receiver_ids", JSON.stringify(bcReceivers));
      if (bcMessage.trim()) fd.append("message", bcMessage.trim());
      if (bcFile) fd.append("file", bcFile);
      const r = await fetch(`${BASE_URL}/documents/broadcast`, {
        method: "POST", headers: authH(), body: fd,
      });
      if (!r.ok) throw new Error((await r.json()).detail || "Broadcast failed");
      setBcMessage(""); setBcFile(null); setBcReceivers([]);
      setBroadcast(false);
      await loadContacts();
    } catch (e) { setError(e.message); }
    finally { setBcSending(false); }
  }

  // ── download ──────────────────────────────────────────────────────────────
  async function handleDownload(doc) {
    try {
      const r = await fetch(`${BASE_URL}/documents/download/${doc.id}`, { headers: authH() });
      if (!r.ok) throw new Error("Download failed");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = doc.filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e.message); }
  }

  // ── delete ────────────────────────────────────────────────────────────────
  async function handleDelete(docId) {
    try {
      const r = await fetch(`${BASE_URL}/documents/delete/${docId}`, {
        method: "DELETE", headers: authH(),
      });
      if (!r.ok) throw new Error((await r.json()).detail || "Delete failed");
      setThread(prev => prev.filter(d => d.id !== docId));
      await loadContacts();
    } catch (e) { setError(e.message); }
  }

  // ── drag & drop ───────────────────────────────────────────────────────────
  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }

  const filtered = contacts.filter(c =>
    c.username.toLowerCase().includes(search.toLowerCase())
  );

  const totalUnread = contacts.reduce((a, c) => a + (c.unread || 0), 0);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>

      {/* ── SIDEBAR ── */}
      <div style={S.sidebar}>
        <div style={S.sideHeader}>
          <div style={S.sideTitle}>
            <span style={{ fontSize: 22 }}>🛡</span>
            <div>
              <div style={S.sideName}>Secure Docs</div>
              <div style={S.sideRole}>{user.username} · {user.role.replace("_", " ")}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {totalUnread > 0 && <div style={S.totalBadge}>{totalUnread}</div>}
            {/* Broadcast button — super admin or admin */}
            <button
              style={S.broadcastBtn}
              onClick={() => { setBroadcast(true); setActive(null); }}
              title="Broadcast to all"
            >
              📢
            </button>
          </div>
        </div>

        <div style={S.searchWrap}>
          <span style={{ fontSize: 13, opacity: 0.4 }}>🔍</span>
          <input
            style={S.searchInput}
            placeholder="Search admins..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div style={S.contactList}>
          {filtered.length === 0 && (
            <div style={S.emptyContacts}>No admins found</div>
          )}
          {filtered.map(c => {
            const isActive = active?.id === c.id && !showBroadcast;
            return (
              <div
                key={c.id}
                style={{ ...S.contactRow, ...(isActive ? S.contactActive : {}) }}
                onClick={() => selectContact(c)}
              >
                <div style={{
                  ...S.avatar,
                  background: c.role === "super_admin"
                    ? "linear-gradient(135deg,#f59e0b,#d97706)"
                    : "linear-gradient(135deg,#00ff88,#00c96a)"
                }}>
                  {c.role === "super_admin" ? "👑" : c.username[0].toUpperCase()}
                </div>
                <div style={S.contactInfo}>
                  <div style={S.contactName}>
                    {c.username}
                    {c.role === "super_admin" && <span style={S.superTag}>SUPER</span>}
                  </div>
                  <div style={S.contactSub}>
                    {c.last_filename
                      ? `${fileIcon(c.last_filename)} ${c.last_filename}`
                      : c.last_message
                        ? `💬 ${c.last_message.slice(0, 28)}${c.last_message.length > 28 ? "…" : ""}`
                        : "No messages yet"}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                  {c.last_at && <div style={S.lastTime}>{fmtTime(c.last_at)}</div>}
                  {c.unread > 0 && <div style={S.unreadBadge}>{c.unread}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── MAIN AREA ── */}
      <div style={S.chat}>

        {/* ── BROADCAST PANEL ── */}
        {showBroadcast && (
          <div style={S.broadcastPanel}>
            <div style={S.chatHeader}>
              <div>
                <div style={S.chatName}>📢 Broadcast Message</div>
                <div style={S.chatRole}>Send to multiple admins at once</div>
              </div>
              <button style={S.closeBtn} onClick={() => setBroadcast(false)}>✕</button>
            </div>

            <div style={{ padding: "20px 24px", flex: 1, overflowY: "auto" }}>
              {error && <div style={S.composeError}>{error}</div>}

              <div style={S.section}>
                <div style={S.sectionLabel}>SELECT RECIPIENTS</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  {contacts.map(c => (
                    <div
                      key={c.id}
                      style={{
                        ...S.recipientChip,
                        ...(bcReceivers.includes(c.id) ? S.recipientChipActive : {})
                      }}
                      onClick={() => setBcReceivers(prev =>
                        prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id]
                      )}
                    >
                      {c.role === "super_admin" ? "👑" : "👤"} {c.username}
                    </div>
                  ))}
                </div>
                {contacts.length > 1 && (
                  <button
                    style={S.selectAllBtn}
                    onClick={() => setBcReceivers(
                      bcReceivers.length === contacts.length ? [] : contacts.map(c => c.id)
                    )}
                  >
                    {bcReceivers.length === contacts.length ? "Deselect All" : "Select All"}
                  </button>
                )}
              </div>

              <div style={S.section}>
                <div style={S.sectionLabel}>MESSAGE</div>
                <textarea
                  style={S.textarea}
                  placeholder="Type your broadcast message..."
                  value={bcMessage}
                  onChange={e => setBcMessage(e.target.value)}
                  rows={3}
                />
              </div>

              <div style={S.section}>
                <div style={S.sectionLabel}>ATTACH FILE (OPTIONAL)</div>
                <div
                  style={{ ...S.dropZone, ...(bcFile ? S.dropZoneHasFile : {}) }}
                  onClick={() => !bcFile && bcFileRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setBcFile(f); }}
                >
                  {bcFile ? (
                    <div style={S.filePreview}>
                      <span style={{ fontSize: 20 }}>{fileIcon(bcFile.name)}</span>
                      <div style={S.filePreviewInfo}>
                        <div style={S.filePreviewName}>{bcFile.name}</div>
                        <div style={S.filePreviewSize}>{fmtSize(bcFile.size)}</div>
                      </div>
                      <button style={S.clearFile} onClick={e => { e.stopPropagation(); setBcFile(null); }}>✕</button>
                    </div>
                  ) : (
                    <div style={S.dropHint}>
                      <span style={{ fontSize: 20 }}>📎</span>
                      <span>Drop file or <span style={{ color: "#00ff88" }}>browse</span></span>
                    </div>
                  )}
                </div>
                <input ref={bcFileRef} type="file" style={{ display: "none" }} onChange={e => setBcFile(e.target.files[0])} />
              </div>

              <button
                style={{ ...S.sendBtn, opacity: (bcMessage.trim() || bcFile) && bcReceivers.length > 0 && !bcSending ? 1 : 0.4 }}
                disabled={(!bcMessage.trim() && !bcFile) || bcReceivers.length === 0 || bcSending}
                onClick={handleBroadcast}
              >
                {bcSending ? "⏳ Sending..." : `📢 Broadcast to ${bcReceivers.length} admin${bcReceivers.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        )}

        {/* ── EMPTY STATE ── */}
        {!showBroadcast && !active && (
          <div style={S.emptyState}>
            <div style={{ fontSize: 56, marginBottom: 8 }}>🔐</div>
            <div style={S.emptyTitle}>Secure Document Sharing</div>
            <div style={S.emptySub}>
              Select an admin from the list to securely share encrypted documents.
              All files are AES-256 encrypted end-to-end.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 16 }}>
              {["🔒 AES-256 encrypted", "📋 Full audit trail", "✅ Read receipts", "📢 Broadcast support"].map(f => (
                <div key={f} style={S.emptyFeature}>{f}</div>
              ))}
            </div>
          </div>
        )}

        {/* ── CONVERSATION ── */}
        {!showBroadcast && active && (
          <>
            <div style={S.chatHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  ...S.avatar, width: 40, height: 40, fontSize: 18,
                  background: active.role === "super_admin"
                    ? "linear-gradient(135deg,#f59e0b,#d97706)"
                    : "linear-gradient(135deg,#00ff88,#00c96a)"
                }}>
                  {active.role === "super_admin" ? "👑" : active.username[0].toUpperCase()}
                </div>
                <div>
                  <div style={S.chatName}>{active.username}</div>
                  <div style={S.chatRole}>{active.role.replace("_", " ")} · {active.email || "—"}</div>
                </div>
              </div>
              <div style={S.encBadge}>🔒 AES-256 encrypted</div>
            </div>

            {/* Messages */}
            <div style={S.messages}>
              {loadingThread && <div style={S.loadingThread}>Loading conversation...</div>}
              {!loadingThread && thread.length === 0 && (
                <div style={S.noMessages}>
                  No messages yet.<br />
                  <span style={{ color: "#4a6070", fontSize: 12 }}>Send a file or message below.</span>
                </div>
              )}
              {thread.map(doc => {
                const isMine = doc.sender_id === user.id;
                const hasFile = doc.filename && doc.filename !== "_text_only_";
                return (
                  <div key={doc.id} style={{ ...S.bubble, ...(isMine ? S.bubbleMine : S.bubbleTheirs) }}>
                    <div style={{ ...S.msgCard, ...(isMine ? S.msgCardMine : S.msgCardTheirs) }}>
                      {/* File attachment */}
                      {hasFile && (
                        <div style={S.fileAttach}>
                          <span style={{ fontSize: 24 }}>{fileIcon(doc.filename)}</span>
                          <div style={S.fileAttachInfo}>
                            <div style={S.fileAttachName}>{doc.filename}</div>
                            <div style={S.fileAttachSize}>{fmtSize(doc.file_size)}</div>
                          </div>
                          <button style={S.dlBtn} onClick={() => handleDownload(doc)}>⬇</button>
                        </div>
                      )}
                      {/* Text message */}
                      {doc.message && (
                        <div style={{ ...S.msgText, ...(hasFile ? S.msgTextWithFile : {}) }}>
                          {doc.message}
                        </div>
                      )}
                    </div>
                    {/* Meta */}
                    <div style={{ ...S.bubbleMeta, ...(isMine ? { justifyContent: "flex-end" } : {}) }}>
                      <span style={S.metaTime}>{fmtTime(doc.sent_at)}</span>
                      {isMine && (
                        <>
                          <span style={{ ...S.metaRead, color: doc.is_read ? "#00ff88" : "#4a6070" }}>
                            {doc.is_read ? "✓✓" : "✓"}
                          </span>
                          <button style={S.delBtn} onClick={() => handleDelete(doc.id)}>🗑</button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Compose */}
            <div style={S.compose}>
              {error && <div style={S.composeError}>{error}</div>}

              <div
                style={{ ...S.dropZone, ...(dragging ? S.dropZoneActive : {}), ...(file ? S.dropZoneHasFile : {}) }}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => !file && fileRef.current?.click()}
              >
                {file ? (
                  <div style={S.filePreview}>
                    <span style={{ fontSize: 20 }}>{fileIcon(file.name)}</span>
                    <div style={S.filePreviewInfo}>
                      <div style={S.filePreviewName}>{file.name}</div>
                      <div style={S.filePreviewSize}>{fmtSize(file.size)}</div>
                    </div>
                    <button style={S.clearFile} onClick={e => { e.stopPropagation(); setFile(null); }}>✕</button>
                  </div>
                ) : (
                  <div style={S.dropHint}>
                    <span style={{ fontSize: 20 }}>📎</span>
                    <span>Attach file — drop here or <span style={{ color: "#00ff88", cursor: "pointer" }}>browse</span></span>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" style={{ display: "none" }} onChange={e => setFile(e.target.files[0])} />

              <div style={S.composeRow}>
                <input
                  style={S.msgInput}
                  placeholder="Type a message..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey && (file || message.trim())) handleSend();
                  }}
                />
                <button
                  style={{ ...S.sendBtn, opacity: (file || message.trim()) && !sending ? 1 : 0.4 }}
                  disabled={(!file && !message.trim()) || sending}
                  onClick={handleSend}
                >
                  {sending ? "⏳" : "📤 Send"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page: { display: "flex", height: "100vh", background: "#080c10", fontFamily: "'Share Tech Mono','Courier New',monospace", color: "#e8eaf0", overflow: "hidden" },

  // Sidebar
  sidebar: { width: 300, minWidth: 260, background: "#0a0f15", borderRight: "1px solid #1a2a1a", display: "flex", flexDirection: "column", flexShrink: 0 },
  sideHeader: { padding: "18px 14px 12px", borderBottom: "1px solid #1a2a1a", display: "flex", alignItems: "center", justifyContent: "space-between" },
  sideTitle: { display: "flex", alignItems: "center", gap: 10 },
  sideName: { color: "#00ff88", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em" },
  sideRole: { color: "#4a6070", fontSize: 10, marginTop: 2, textTransform: "capitalize" },
  totalBadge: { background: "#ff4444", color: "#fff", borderRadius: 12, fontSize: 10, fontWeight: 700, padding: "2px 7px" },
  broadcastBtn: { background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.2)", borderRadius: 6, cursor: "pointer", padding: "4px 8px", fontSize: 14 },
  searchWrap: { display: "flex", alignItems: "center", gap: 8, margin: "10px 12px 4px", background: "#111820", border: "1px solid #1e3040", borderRadius: 8, padding: "7px 12px" },
  searchInput: { background: "none", border: "none", outline: "none", color: "#e8eaf0", fontSize: 12, fontFamily: "inherit", flex: 1 },
  contactList: { flex: 1, overflowY: "auto", padding: "6px 0" },
  emptyContacts: { color: "#4a6070", fontSize: 12, textAlign: "center", padding: 20 },
  contactRow: { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid rgba(30,48,64,0.3)", transition: "background 0.15s" },
  contactActive: { background: "rgba(0,255,136,0.07)", borderLeft: "3px solid #00ff88" },
  avatar: { width: 38, height: 38, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: "#080c10", flexShrink: 0 },
  contactInfo: { flex: 1, minWidth: 0 },
  contactName: { color: "#e8eaf0", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 },
  superTag: { background: "rgba(245,158,11,0.15)", color: "#f59e0b", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, border: "1px solid rgba(245,158,11,0.3)" },
  contactSub: { color: "#4a6070", fontSize: 11, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  lastTime: { color: "#2a4060", fontSize: 10 },
  unreadBadge: { background: "#00ff88", color: "#080c10", borderRadius: 12, fontSize: 10, fontWeight: 700, padding: "2px 7px", minWidth: 18, textAlign: "center" },

  // Chat
  chat: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#080c10" },
  chatHeader: { padding: "12px 20px", borderBottom: "1px solid #1a2a1a", background: "#0a0f15", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 },
  chatName: { color: "#e8eaf0", fontWeight: 700, fontSize: 14 },
  chatRole: { color: "#4a6070", fontSize: 11, marginTop: 2, textTransform: "capitalize" },
  encBadge: { background: "rgba(0,255,136,0.08)", color: "#00ff88", border: "1px solid rgba(0,255,136,0.2)", borderRadius: 6, fontSize: 11, padding: "4px 10px" },
  closeBtn: { background: "rgba(255,60,60,0.1)", border: "1px solid rgba(255,60,60,0.3)", color: "#ff6060", borderRadius: 6, cursor: "pointer", padding: "4px 10px", fontSize: 13 },
  messages: { flex: 1, overflowY: "auto", padding: "16px 24px", display: "flex", flexDirection: "column", gap: 12 },
  loadingThread: { color: "#4a6070", fontSize: 12, textAlign: "center", padding: 20 },
  noMessages: { textAlign: "center", color: "#2a4060", fontSize: 14, margin: "auto", lineHeight: 2 },

  // Bubbles
  bubble: { display: "flex", flexDirection: "column", maxWidth: "70%" },
  bubbleMine: { alignSelf: "flex-end", alignItems: "flex-end" },
  bubbleTheirs: { alignSelf: "flex-start", alignItems: "flex-start" },
  msgCard: { borderRadius: 10, padding: "10px 12px", border: "1px solid", minWidth: 200 },
  msgCardMine: { background: "rgba(0,255,136,0.08)", borderColor: "rgba(0,255,136,0.2)" },
  msgCardTheirs: { background: "rgba(255,255,255,0.04)", borderColor: "#1e3040" },
  fileAttach: { display: "flex", alignItems: "center", gap: 10 },
  fileAttachInfo: { flex: 1, minWidth: 0 },
  fileAttachName: { color: "#e8eaf0", fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  fileAttachSize: { color: "#4a6070", fontSize: 10, marginTop: 2 },
  dlBtn: { background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.2)", borderRadius: 6, color: "#00ff88", cursor: "pointer", padding: "4px 8px", fontSize: 13, flexShrink: 0 },
  msgText: { color: "#c8cad0", fontSize: 13, lineHeight: 1.5 },
  msgTextWithFile: { marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)" },
  bubbleMeta: { display: "flex", alignItems: "center", gap: 6, marginTop: 3, padding: "0 2px" },
  metaTime: { color: "#2a4060", fontSize: 10 },
  metaRead: { fontSize: 10, fontWeight: 700 },
  delBtn: { background: "none", border: "none", cursor: "pointer", color: "#2a4060", fontSize: 11, padding: "0 2px" },

  // Empty
  emptyState: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, gap: 10 },
  emptyTitle: { color: "#e8eaf0", fontSize: 18, fontWeight: 700 },
  emptySub: { color: "#4a6070", fontSize: 13, textAlign: "center", maxWidth: 360, lineHeight: 1.7 },
  emptyFeature: { background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.15)", color: "#00ff88", borderRadius: 6, fontSize: 12, padding: "5px 12px" },

  // Broadcast
  broadcastPanel: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 },
  section: { marginBottom: 20 },
  sectionLabel: { color: "#4a6070", fontSize: 10, letterSpacing: "0.1em", fontWeight: 700, marginBottom: 4 },
  recipientChip: { padding: "6px 12px", borderRadius: 20, border: "1px solid #1e3040", color: "#6b8090", fontSize: 12, cursor: "pointer", background: "#111820", transition: "all 0.15s" },
  recipientChipActive: { background: "rgba(0,255,136,0.1)", borderColor: "rgba(0,255,136,0.3)", color: "#00ff88" },
  selectAllBtn: { marginTop: 8, background: "none", border: "1px solid #1e3040", color: "#4a6070", borderRadius: 6, padding: "5px 12px", fontSize: 11, cursor: "pointer", fontFamily: "inherit" },
  textarea: { width: "100%", background: "#111820", border: "1px solid #1e3040", borderRadius: 8, padding: "10px 12px", color: "#e8eaf0", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box" },

  // Compose
  compose: { borderTop: "1px solid #1a2a1a", background: "#0a0f15", padding: "12px 18px 16px", flexShrink: 0 },
  composeError: { background: "rgba(255,60,60,0.1)", border: "1px solid rgba(255,60,60,0.3)", borderRadius: 6, color: "#ff6060", fontSize: 12, padding: "7px 12px", marginBottom: 8 },
  dropZone: { border: "1.5px dashed #1e3040", borderRadius: 8, padding: "12px 14px", marginBottom: 8, cursor: "pointer", transition: "all 0.2s", background: "#0d1520" },
  dropZoneActive: { borderColor: "#00ff88", background: "rgba(0,255,136,0.05)" },
  dropZoneHasFile: { borderStyle: "solid", borderColor: "rgba(0,255,136,0.3)", background: "rgba(0,255,136,0.04)" },
  dropHint: { display: "flex", alignItems: "center", gap: 10, color: "#4a6070", fontSize: 12 },
  filePreview: { display: "flex", alignItems: "center", gap: 10 },
  filePreviewInfo: { flex: 1, minWidth: 0 },
  filePreviewName: { color: "#e8eaf0", fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  filePreviewSize: { color: "#4a6070", fontSize: 10, marginTop: 2 },
  clearFile: { background: "rgba(255,60,60,0.1)", border: "1px solid rgba(255,60,60,0.3)", color: "#ff6060", borderRadius: 4, cursor: "pointer", padding: "2px 7px", fontSize: 11, flexShrink: 0 },
  composeRow: { display: "flex", gap: 8 },
  msgInput: { flex: 1, background: "#111820", border: "1px solid #1e3040", borderRadius: 8, padding: "9px 12px", color: "#e8eaf0", fontSize: 13, fontFamily: "inherit", outline: "none" },
  sendBtn: { background: "#00ff88", color: "#080c10", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", transition: "opacity 0.2s" },
};