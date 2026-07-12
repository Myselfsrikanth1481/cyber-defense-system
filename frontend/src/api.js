const BASE_URL = "https://excusable-agile-mourner.ngrok-free.dev";

function getToken() { return localStorage.getItem("token"); }
function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` };
}

export async function loginUser(username, password) {
  const form = new URLSearchParams();
  form.append("username", username);
  form.append("password", password);
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  if (!res.ok) throw new Error((await res.json()).detail || "Login failed");
  return res.json();
}

export async function registerUser(username, password) {
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error((await res.json()).detail || "Registration failed");
  return res.json();
}

export async function verifyFace(file, tempToken) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE_URL}/auth/verify-face`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tempToken}` },
    body: formData,
  });
  if (!res.ok) throw new Error((await res.json()).detail || "Face verification failed");
  return res.json();
}

export async function registerFace(file, token) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE_URL}/auth/register-face`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) throw new Error((await res.json()).detail || "Face registration failed");
  return res.json();
}

export async function getMe() {
  const res = await fetch(`${BASE_URL}/auth/me`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Unauthorized");
  return res.json();
}

export async function getSecurityLogs(limit = 50) {
  const res = await fetch(`${BASE_URL}/admin/logs?limit=${limit}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch logs");
  return res.json();
}

export async function getBlockedIPs() {
  const res = await fetch(`${BASE_URL}/admin/blocked-ips`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch blocked IPs");
  return res.json();
}

export async function blockIP(ip) {
  const res = await fetch(`${BASE_URL}/admin/block-ip`, {
    method: "POST", headers: authHeaders(), body: JSON.stringify({ ip }),
  });
  if (!res.ok) throw new Error("Failed to block IP");
  return res.json();
}

export async function unblockIP(ip) {
  const res = await fetch(`${BASE_URL}/admin/unblock-ip`, {
    method: "POST", headers: authHeaders(), body: JSON.stringify({ ip }),
  });
  if (!res.ok) throw new Error("Failed to unblock IP");
  return res.json();
}

export async function getMetrics() {
  const res = await fetch(`${BASE_URL}/admin/metrics`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch metrics");
  return res.json();
}

export async function getTrafficStats() {
  const res = await fetch(`${BASE_URL}/admin/traffic-stats`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch traffic");
  return res.json();
}

export async function getVaultItems() {
  const res = await fetch(`${BASE_URL}/vault/items`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch vault");
  return res.json();
}

export async function uploadVaultFile(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE_URL}/vault/upload`, {
    method: "POST", headers: { Authorization: `Bearer ${getToken()}` }, body: formData,
  });
  if (!res.ok) throw new Error("Upload failed");
  return res.json();
}

export async function downloadVaultFile(itemId, filename) {
  const res = await fetch(`${BASE_URL}/vault/download/${itemId}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  window.URL.revokeObjectURL(url);
}

export async function deleteVaultItem(itemId) {
  const res = await fetch(`${BASE_URL}/vault/delete/${itemId}`, {
    method: "DELETE", headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Delete failed");
  return res.json();
}

// ── User Management ────────────────────────────────────────────────────────────

export async function getUsers() {
  const res = await fetch(`${BASE_URL}/admin/users`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

export async function deleteUser(userId) {
  const res = await fetch(`${BASE_URL}/admin/users/${userId}`, {
    method: "DELETE", headers: authHeaders(),
  });
  if (!res.ok) throw new Error((await res.json()).detail || "Failed to delete user");
  return res.json();
}

// ── Document Messaging ─────────────────────────────────────────────────────────

export async function getContacts() {
  const res = await fetch(`${BASE_URL}/documents/contacts`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch contacts");
  return res.json();
}

export async function getConversation(userId) {
  const res = await fetch(`${BASE_URL}/documents/conversation/${userId}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch conversation");
  return res.json();
}

export async function sendDocument(receiverId, message, file) {
  const formData = new FormData();
  formData.append("receiver_id", receiverId);
  if (message) formData.append("message", message);
  if (file) formData.append("file", file);
  const res = await fetch(`${BASE_URL}/documents/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` },
    body: formData,
  });
  if (!res.ok) throw new Error((await res.json()).detail || "Send failed");
  return res.json();
}

export async function broadcastDocument(receiverIds, message, file) {
  const formData = new FormData();
  formData.append("receiver_ids", JSON.stringify(receiverIds));
  if (message) formData.append("message", message);
  if (file) formData.append("file", file);
  const res = await fetch(`${BASE_URL}/documents/broadcast`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` },
    body: formData,
  });
  if (!res.ok) throw new Error((await res.json()).detail || "Broadcast failed");
  return res.json();
}

export async function downloadSharedDoc(docId, filename) {
  const res = await fetch(`${BASE_URL}/documents/download/${docId}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  window.URL.revokeObjectURL(url);
}

export async function deleteSharedDoc(docId) {
  const res = await fetch(`${BASE_URL}/documents/delete/${docId}`, {
    method: "DELETE", headers: authHeaders(),
  });
  if (!res.ok) throw new Error((await res.json()).detail || "Delete failed");
  return res.json();
}

export async function getUnreadTotal() {
  const res = await fetch(`${BASE_URL}/documents/unread-total`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch unread count");
  return res.json();
}

export async function markAsRead(docId) {
  const res = await fetch(`${BASE_URL}/documents/read/${docId}`, {
    method: "PATCH", headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to mark as read");
  return res.json();
}

// ── Admin Invite (Super Admin) ──────────────────────────────────────────────

export async function createAdminInvite(name, email, phone) {
  const res = await fetch(`${BASE_URL}/admin-invite/create`, {
    method: "POST", headers: authHeaders(),
    body: JSON.stringify({ name, email, phone }),
  });
  if (!res.ok) throw new Error((await res.json()).detail || "Failed to create invite");
  return res.json();
}

export async function getPendingInvites() {
  const res = await fetch(`${BASE_URL}/admin-invite/pending`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch invites");
  return res.json();
}

export async function approveInvite(inviteId) {
  const res = await fetch(`${BASE_URL}/admin-invite/approve/${inviteId}`, {
    method: "POST", headers: authHeaders(),
  });
  if (!res.ok) throw new Error((await res.json()).detail || "Failed to approve");
  return res.json();
}

export async function rejectInvite(inviteId) {
  const res = await fetch(`${BASE_URL}/admin-invite/reject/${inviteId}`, {
    method: "DELETE", headers: authHeaders(),
  });
  if (!res.ok) throw new Error((await res.json()).detail || "Failed to reject");
  return res.json();
}

export async function verifyInviteCode(code) {
  const res = await fetch(`${BASE_URL}/admin-invite/verify-code`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error((await res.json()).detail || "Invalid code");
  return res.json();
}

export async function setInvitePassword(code, password) {
  const res = await fetch(`${BASE_URL}/admin-invite/set-password`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, password }),
  });
  if (!res.ok) throw new Error((await res.json()).detail || "Failed to set password");
  return res.json();
}

// ── Login Logs & User Block/Unblock ───────────────────────────────────────────

export async function getLoginLogs() {
  const res = await fetch(`${BASE_URL}/admin/login-logs`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch login logs");
  return res.json();
}

export async function blockUser(userId) {
  const res = await fetch(`${BASE_URL}/admin/block-user/${userId}`, {
    method: "POST", headers: authHeaders(),
  });
  if (!res.ok) throw new Error((await res.json()).detail || "Failed to block user");
  return res.json();
}

export async function unblockUser(userId) {
  const res = await fetch(`${BASE_URL}/admin/unblock-user/${userId}`, {
    method: "POST", headers: authHeaders(),
  });
  if (!res.ok) throw new Error((await res.json()).detail || "Failed to unblock user");
  return res.json();
}