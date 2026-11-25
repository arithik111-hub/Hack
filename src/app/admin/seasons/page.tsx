"use client";

import { useEffect, useState } from "react";

type Season = { id: string; animeId: string; seasonNumber: number; title: string; episodeCount: number; releaseYear: number | null; anime: { id: string; title: string }; _count: { episodes: number } };
type Anime = { id: string; title: string };

export default function AdminSeasonsPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [animes, setAnimes] = useState<Anime[]>([]);
  const [editing, setEditing] = useState<Season | null>(null);
  const [animeId, setAnimeId] = useState("");
  const [seasonNumber, setSeasonNumber] = useState("1");
  const [title, setTitle] = useState("");
  const [episodeCount, setEpisodeCount] = useState("0");
  const [releaseYear, setReleaseYear] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/admin/seasons");
    const data = (await response.json()) as { seasons?: Season[]; animes?: Anime[]; error?: string };
    if (!response.ok) { setError(data.error ?? "Seasons could not be loaded."); return; }
    setSeasons(data.seasons ?? []);
    setAnimes(data.animes ?? []);
  }
  useEffect(() => {
    fetch("/api/admin/seasons")
      .then(async (response) => {
        const data = (await response.json()) as { seasons?: Season[]; animes?: Anime[]; error?: string };
        if (!response.ok) {
          setError(data.error ?? "Seasons could not be loaded.");
          return;
        }
        setSeasons(data.seasons ?? []);
        setAnimes(data.animes ?? []);
      })
      .catch(() => setError("Seasons could not be loaded."));
  }, []);

  function reset() {
    setEditing(null); setAnimeId(""); setSeasonNumber("1"); setTitle(""); setEpisodeCount("0"); setReleaseYear("");
  }
  function edit(season: Season) {
    setEditing(season); setAnimeId(season.animeId); setSeasonNumber(String(season.seasonNumber)); setTitle(season.title); setEpisodeCount(String(season.episodeCount)); setReleaseYear(season.releaseYear ? String(season.releaseYear) : "");
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(""); setMessage("");
    const payload = { ...(editing ? { id: editing.id } : {}), animeId, seasonNumber, title, episodeCount, releaseYear: releaseYear ? Number(releaseYear) : null };
    const response = await fetch("/api/admin/seasons", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) { setError(data.error ?? "Season could not be saved."); return; }
    setMessage(editing ? "Season updated." : "Season added.");
    reset(); await load();
  }
  async function removeSeason(season: Season) {
    if (!window.confirm(`Delete ${season.title}? Episodes must be removed first.`)) return;
    const response = await fetch("/api/admin/seasons", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: season.id }) });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) { setError(data.error ?? "Season could not be deleted."); return; }
    await load();
  }
  const filtered = seasons.filter((season) => `${season.anime.title} ${season.title}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <header className="admin-page-header"><div><p>CONTENT STRUCTURE</p><h1>Season management</h1></div></header>
      {error && <p className="admin-alert admin-alert--error" role="alert">{error}</p>}
      {message && <p className="auth-success" role="status">{message}</p>}
      <form className="admin-inline-form admin-season-form" onSubmit={submit}>
        <label>Anime<select value={animeId} onChange={(event) => setAnimeId(event.target.value)} required><option value="">Choose anime</option>{animes.map((anime) => <option value={anime.id} key={anime.id}>{anime.title}</option>)}</select></label>
        <label>Season number<input type="number" min="1" value={seasonNumber} onChange={(event) => setSeasonNumber(event.target.value)} required /></label>
        <label>Season title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Season 1" required /></label>
        <label>Episode count<input type="number" min="0" value={episodeCount} onChange={(event) => setEpisodeCount(event.target.value)} required /></label>
        <label>Release year<input type="number" min="1900" max="2100" value={releaseYear} onChange={(event) => setReleaseYear(event.target.value)} /></label>
        <div className="admin-form-actions"><button className="admin-primary-button" type="submit">{editing ? "Save changes" : "Add season"}</button>{editing && <button className="admin-secondary-button" type="button" onClick={reset}>Cancel</button>}</div>
      </form>
      <label className="admin-search">Search seasons<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Anime or season title" /></label>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Anime</th><th>Season</th><th>Title</th><th>Episodes</th><th>Year</th><th>Actions</th></tr></thead><tbody>{filtered.map((season) => <tr key={season.id}><td><strong>{season.anime.title}</strong></td><td>{season.seasonNumber}</td><td>{season.title}</td><td>{season._count.episodes}</td><td>{season.releaseYear ?? "—"}</td><td><div className="admin-row-actions"><button type="button" onClick={() => edit(season)}>Edit</button><button type="button" onClick={() => removeSeason(season)}>Delete</button></div></td></tr>)}</tbody></table>{!filtered.length && <p className="admin-empty">No seasons found.</p>}</div>
    </div>
  );
}
