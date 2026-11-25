import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin settings" };

export default function AdminSettingsPage() {
  return (
    <div>
      <header className="admin-page-header"><div><p>PLATFORM</p><h1>Settings</h1></div></header>
      <section className="admin-panel">
        <h2>Environment configuration</h2>
        <dl className="admin-settings-list">
          <div><dt>Database</dt><dd>{process.env.DATABASE_URL ? "Configured" : "DATABASE_URL not configured"}</dd></div>
          <div><dt>Authentication secret</dt><dd>{process.env.AUTH_SECRET ? "Configured" : "AUTH_SECRET not configured"}</dd></div>
          <div><dt>Public website</dt><dd>ANIMEX</dd></div>
        </dl>
        <p className="admin-empty">Sensitive credentials are not displayed here.</p>
      </section>
    </div>
  );
}
