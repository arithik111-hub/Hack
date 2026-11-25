"use client";

import { useEffect, useMemo, useState } from "react";

type Episode = { id: string; animeId: string; seasonId: string; episodeNumber: number; title: string; description: string; thumbnail: string; duration: number; releaseDate: string; published: boolean; anime: { id: string; title: string }; season: { id: string; title: string; seasonNumber: number } };
type Anime = { id: string; title: string };
type Season = { id: string; title: string; seasonNumber: number; animeId: string; anime: { title: string } };

export default function AdminEpisodesPage() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [animes, setAnimes] = useState<Anime[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [editing, setEditing] = useState<Episode | null>(null);
  const [animeId, setAnimeId] = useState("");
  const [seasonId, setSeasonId] = useState("");
  const [episodeNumber, setEpisodeNumber] = useState("1");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [duration, setDuration] = useState("24");
  const [releaseDate, setReleaseDate] = useState("");
  const [published, setPublished] = useState(true);
  const [search, setSearch] = useState("");
  const [filterAnime, setFilterAnime] = useState("");
  const [filterSeason, setFilterSeason] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/admin/episodes");
    const data = (await response.json()) as { episodes?: Episode[]; animes?: Anime[]; seasons?: Season[]; error?: string };
    if (!response.ok) { setError(data.error ?? "Episodes could not be loaded."); return; }
    setEpisodes(data.episodes ?? []);
    setAnimes(data.animes ?? []);
    setSeasons(data.seasons ?? []);
  }
  useEffect(() => {
    fetch("/api/admin/episodes")
      .then(async (response) => {
        const data = (await response.json()) as { episodes?: Episode[]; animes?: Anime[]; seasons?: Season[]; error?: string };
        if (!response.ok) {
          setError(data.error ?? "Episodes could not be loaded.");
          return;
        }
        setEpisodes(data.episodes ?? []);
        setAnimes(data.animes ?? []);
        setSeasons(data.seasons ?? []);
      })
      .catch(() => setError("Episodes could not be loaded."));
  }, []);

  function reset() {
    setEditing(null); setAnimeId(""); setSeasonId(""); setEpisodeNumber("1"); setTitle(""); setDescription(""); setThumbnail(""); setDuration("24"); setReleaseDate(""); setPublished(true);
  }
  function edit(episode: Episode) {
    setEditing(episode); setAnimeId(episode.animeId); setSeasonId(episode.seasonId); setEpisodeNumber(String(episode.episodeNumber)); setTitle(episode.title); setDescription(episode.description); setThumbnail(episode.thumbnail); setDuration(String(episode.duration)); setReleaseDate(episode.releaseDate.slice(0, 10)); setPublished(episode.published);
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(""); setMessage("");
    const payload = { ...(editing ? { id: editing.id } : {}), animeId, seasonId, episodeNumber, title, description, thumbnail, duration, releaseDate, published };
    const response = await fetch("/api/admin/episodes", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) { setError(data.error ?? "Episode could not be saved."); return; }
    setMessage(editing ? "Episode updated." : "Episode added.");
    reset(); await load();
  }
  async function removeEpisode(episode: Episode) {
    if (!window.confirm(`Delete episode ${episode.episodeNumber}: ${episode.title}?`)) return;
    const response = await fetch("/api/admin/episodes", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: episode.id }) });
    if (!response.ok) { setError("Episode could not be deleted."); return; }
    await load();
  }

  const availableSeasons = seasons.filter((season) => season.animeId === animeId);
  const filtered = useMemo(() => episodes.filter((episode) =>
    (!filterAnime || episode.animeId === filterAnime) &&
    (!filterSeason || episode.seasonId === filterSeason) &&
    (!search || `${episode.title} ${episode.anime.title}`.toLowerCase().includes(search.toLowerCase()))
  ), [episodes, filterAnime, filterSeason, search]);

  return (
    <div>
      <header className="admin-page-header"><div><p>CONTENT STRUCTURE</p><h1>Episode management</h1></div></header>
      {error && <p className="admin-alert admin-alert--error" role="alert">{error}</p>}
      {message && <p className="auth-success" role="status">{message}</p>}
      <form className="admin-form" onSubmit={submit}>
        <div className="admin-form-grid">
          <label>Anime<select value={animeId} onChange={(event) => { setAnimeId(event.target.value); setSeasonId(""); }} required><option value="">Choose anime</option>{animes.map((anime) => <option value={anime.id} key={anime.id}>{anime.title}</option>)}</select></label>
          <label>Season<select value={seasonId} onChange={(event) => setSeasonId(event.target.value)} required><option value="">Choose season</option>{availableSeasons.map((season) => <option value={season.id} key={season.id}>{season.title}</option>)}</select></label>
          <label>Episode number<input type="number" min="1" value={episodeNumber} onChange={(event) => setEpisodeNumber(event.target.value)} required /></label>
          <label>Episode title<input value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
          <label>Duration (minutes)<input type="number" min="1" value={duration} onChange={(event) => setDuration(event.target.value)} required /></label>
          <label>Release date<input type="date" value={releaseDate} onChange={(event) => setReleaseDate(event.target.value)} required /></label>
          <label className="admin-form-wide">Thumbnail URL<input type="url" value={thumbnail} onChange={(event) => setThumbnail(event.target.value)} required /></label>
          <label className="admin-form-wide">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} required /></label>
        </div>
        <label className="admin-check-line"><input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} /> Published</label>
        <div className="admin-form-actions"><button className="admin-primary-button" type="submit">{editing ? "Save changes" : "Add episode"}</button>{editing && <button className="admin-secondary-button" type="button" onClick={reset}>Cancel</button>}</div>
      </form>
      <div className="admin-toolbar">
        <label>Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Episode or anime" /></label>
        <label>Anime<select value={filterAnime} onChange={(event) => { setFilterAnime(event.target.value); setFilterSeason(""); }}><option value="">All anime</option>{animes.map((anime) => <option value={anime.id} key={anime.id}>{anime.title}</option>)}</select></label>
        <label>Season<select value={filterSeason} onChange={(event) => setFilterSeason(event.target.value)}><option value="">All seasons</option>{seasons.filter((season) => !filterAnime || season.animeId === filterAnime).map((season) => <option value={season.id} key={season.id}>{season.anime.title} · {season.title}</option>)}</select></label>
      </div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Episode</th><th>Anime</th><th>Season</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.map((episode) => <tr key={episode.id}><td><strong>{episode.title}</strong><small>Episode {episode.episodeNumber} · {episode.duration} min</small></td><td>{episode.anime.title}</td><td>{episode.season.title}</td><td>{new Date(episode.releaseDate).toLocaleDateString()}</td><td>{episode.published ? "Published" : "Draft"}</td><td><div className="admin-row-actions"><button type="button" onClick={() => edit(episode)}>Edit</button><button type="button" onClick={() => removeEpisode(episode)}>Delete</button></div></td></tr>)}</tbody></table>{!filtered.length && <p className="admin-empty">No episodes found.</p>}</div>
    </div>
  );
}
