"use client";

import { useEffect, useMemo, useState } from "react";

type User = { id: string; name: string; email: string; role: "USER" | "ADMIN"; active: boolean; createdAt: string; image: string | null; _count: { watchlist: number; favorites: number; watchHistory: number } };

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/admin/users");
    const data = (await response.json()) as { users?: User[]; error?: string };
    if (!response.ok) { setError(data.error ?? "Users could not be loaded."); return; }
    setUsers(data.users ?? []);
  }
  useEffect(() => {
    fetch("/api/admin/users")
      .then(async (response) => {
        const data = (await response.json()) as { users?: User[]; error?: string };
        if (!response.ok) {
          setError(data.error ?? "Users could not be loaded.");
          return;
        }
        setUsers(data.users ?? []);
      })
      .catch(() => setError("Users could not be loaded."));
  }, []);

  async function toggleStatus(user: User) {
    setError(""); setMessage("");
    const response = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: user.id, active: !user.active }) });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) { setError(data.error ?? "Account status could not be changed."); return; }
    setMessage(user.active ? "Account disabled." : "Account enabled.");
    await load();
  }

  const filtered = useMemo(() => users.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(search.toLowerCase())),
    [users, search]);

  return (
    <div>
      <header className="admin-page-header"><div><p>MEMBERS</p><h1>User management</h1></div></header>
      {error && <p className="admin-alert admin-alert--error" role="alert">{error}</p>}
      {message && <p className="auth-success" role="status">{message}</p>}
      <label className="admin-search">Search users<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or email" /></label>
      <div className="admin-table-wrap">
        <table className="admin-table"><thead><tr><th>User</th><th>Role</th><th>Watchlist</th><th>Favorites</th><th>History</th><th>Joined</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{filtered.map((user) => <tr key={user.id}><td><strong>{user.name}</strong><small>{user.email}</small></td><td>{user.role}</td><td>{user._count.watchlist}</td><td>{user._count.favorites}</td><td>{user._count.watchHistory}</td><td>{new Date(user.createdAt).toLocaleDateString()}</td><td>{user.active ? "Active" : "Disabled"}</td><td><div className="admin-row-actions"><button type="button" onClick={() => setSelected(user)}>View</button><button type="button" onClick={() => toggleStatus(user)}>{user.active ? "Disable" : "Enable"}</button></div></td></tr>)}</tbody>
        </table>
        {!filtered.length && <p className="admin-empty">No users found.</p>}
      </div>
      {selected && (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <article className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="user-detail-title">
            <button className="admin-modal-close" type="button" onClick={() => setSelected(null)} aria-label="Close">×</button>
            <p className="eyebrow">ACCOUNT DETAILS</p>
            <h2 id="user-detail-title">{selected.name}</h2>
            <dl className="admin-settings-list"><div><dt>Email</dt><dd>{selected.email}</dd></div><div><dt>Role</dt><dd>{selected.role}</dd></div><div><dt>Status</dt><dd>{selected.active ? "Active" : "Disabled"}</dd></div><div><dt>Registered</dt><dd>{new Date(selected.createdAt).toLocaleString()}</dd></div></dl>
          </article>
        </div>
      )}
    </div>
  );
}
