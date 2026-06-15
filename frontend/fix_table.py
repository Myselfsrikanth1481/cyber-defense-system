import re

content = open('src/pages/SuperAdminDashboard.jsx', 'r', encoding='utf-8').read()

# Fix the users table headers - remove Created column to give more space
content = content.replace(
    '["#", "Username", "Email", "Face ID", "Created", "Last Login", "Last IP", "Actions"].map(h => <th key={h} style={s.th}>{h}</th>)',
    '["#", "Username", "Email", "Face ID", "Last Login", "Last IP", "Actions"].map(h => <th key={h} style={s.th}>{h}</th>)'
)

# Fix UserRow - remove Created cell
old_row = '''        <td style={{ ...s.td, color: "#6b8090", fontSize: 11 }}>{u.created_at && u.created_at !== "None" ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
        <td style={{ ...s.td, color: "#6b8090", fontSize: 11 }}>{u.last_login && u.last_login !== "None" ? formatTime(u.last_login) : "Never"}</td>'''

new_row = '''        <td style={{ ...s.td, color: "#6b8090", fontSize: 11 }}>{u.last_login && u.last_login !== "None" ? formatTime(u.last_login) : "Never"}</td>'''

content = content.replace(old_row, new_row)

open('src/pages/SuperAdminDashboard.jsx', 'w', encoding='utf-8').write(content)
print('Fixed!')
