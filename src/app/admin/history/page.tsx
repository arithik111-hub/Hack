import type { Metadata } from "next";
import { getDatabase } from "@/lib/db";

export const metadata: Metadata = { title: "Watch history" };

async function loadHistory() {
  try {
    return { entries: await getDatabase().watchHistory.findMany({
      orderBy: { updatedAt: "desc" }, take: 100,
      include: { user: { select: { name: true, email: true } }, episode: { include: { anime: { select: { title: true } } } } },
    }), error: "" };
  } catch (caught) {
    return { entries: [], error: caught instanceof Error ? caught.message : "Configure PostgreSQL." };
  }
}

export default async function AdminHistoryPage() {
  const { entries, error } = await loadHistory();
  return <div><header className="admin-page-header"><div><p>ACTIVITY</p><h1>Watch history</h1></div></header>{error ? <div className="admin-alert admin-alert--error"><strong>Database unavailable</strong><p>{error}</p></div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>User</th><th>Anime</th><th>Episode</th><th>Progress</th><th>Status</th><th>Updated</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id}><td><strong>{entry.user.name}</strong><small>{entry.user.email}</small></td><td>{entry.episode.anime.title}</td><td>{entry.episode.title}</td><td>{entry.progressSeconds}s</td><td>{entry.completed ? "Completed" : "In progress"}</td><td>{entry.updatedAt.toLocaleString()}</td></tr>)}</tbody></table>{!entries.length && <p className="admin-empty">No viewing activity has been recorded.</p>}</div>}</div>;
}
