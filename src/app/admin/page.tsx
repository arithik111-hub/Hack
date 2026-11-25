import type { Metadata } from "next";
import Link from "next/link";
import { getDatabase } from "@/lib/db";

export const metadata: Metadata = { title: "Admin overview" };

export default async function AdminOverviewPage() {
  let stats: {
    anime: number; seasons: number; episodes: number; genres: number; users: number; admins: number; watchlist: number; favorites: number;
  } | null = null;
  let recentAnime: Array<{ id: string; title: string; slug: string; createdAt: Date; updatedAt: Date }> = [];
  let recentEpisodes: Array<{ id: string; title: string; anime: { title: string }; releaseDate: Date }> = [];
  let recentUsers: Array<{ id: string; name: string; email: string; createdAt: Date }> = [];
  let dbError = "";

  try {
    const db = getDatabase();
    const [anime, seasons, episodes, genres, users, admins, watchlist, favorites, animeRows, episodeRows, userRows] =
      await Promise.all([
        db.anime.count(), db.season.count(), db.episode.count(), db.genre.count(),
        db.user.count(), db.user.count({ where: { role: "ADMIN" } }),
        db.watchlist.count(), db.favorite.count(),
        db.anime.findMany({ orderBy: { updatedAt: "desc" }, take: 5, select: { id: true, title: true, slug: true, createdAt: true, updatedAt: true } }),
        db.episode.findMany({ orderBy: { releaseDate: "desc" }, take: 5, include: { anime: { select: { title: true } } } }),
        db.user.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { id: true, name: true, email: true, createdAt: true } }),
      ]);
    stats = { anime, seasons, episodes, genres, users, admins, watchlist, favorites };
    recentAnime = animeRows;
    recentEpisodes = episodeRows;
    recentUsers = userRows;
  } catch (error) {
    dbError = error instanceof Error ? error.message : "Database unavailable.";
  }

  return (
    <div>
      <header className="admin-page-header"><div><p>CONTROL CENTER</p><h1>Dashboard overview</h1></div></header>
      {dbError ? <div className="admin-alert admin-alert--error"><strong>Database unavailable</strong><p>{dbError}</p></div> : stats && (
        <>
          <section className="admin-stat-grid">
            {Object.entries(stats).map(([label, value]) => <article className="admin-stat" key={label}><span>{label.replace(/^./, (character) => character.toUpperCase())}</span><strong>{value}</strong></article>)}
          </section>
          <div className="admin-two-columns">
            <section className="admin-panel"><h2>Recent content updates</h2>{recentAnime.length ? recentAnime.map((anime) => <Link className="admin-list-row" href={`/admin/anime/${anime.id}/edit`} key={anime.id}><span>{anime.title}</span><small>Updated {anime.updatedAt.toLocaleDateString()}</small></Link>) : <p className="admin-empty">No anime content updates yet.</p>}</section>
            <section className="admin-panel"><h2>Recent episodes</h2>{recentEpisodes.length ? recentEpisodes.map((episode) => <Link className="admin-list-row" href="/admin/episodes" key={episode.id}><span>{episode.anime.title} · {episode.title}</span><small>{episode.releaseDate.toLocaleDateString()}</small></Link>) : <p className="admin-empty">No episodes added yet.</p>}</section>
          </div>
          <section className="admin-panel"><h2>Recent registrations</h2>{recentUsers.length ? recentUsers.map((user) => <div className="admin-list-row" key={user.id}><span>{user.name}</span><small>{user.email} · {user.createdAt.toLocaleDateString()}</small></div>) : <p className="admin-empty">No registered users yet.</p>}</section>
        </>
      )}
    </div>
  );
}
