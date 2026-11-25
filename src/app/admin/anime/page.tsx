"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type Anime = {
  id: string;
  title: string;
  slug: string;
  poster: string;
  releaseYear: number;
  rating: number;
  status: "AIRING" | "COMPLETED" | "UPCOMING";
  published: boolean;
  featured: boolean;
  trending: boolean;
  genres: Array<{ genre: { name: string; slug: string } }>;
  _count: { episodes: number };
};

export default function AdminAnimePage() {
  const [animes, setAnimes] = useState<Anime[]>([]);
  const [genres, setGenres] = useState<Array<{ name: string; slug: string }>>([]);
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("title");
  const [error, setError] = useState("");

  async function load() {
    setError("");
    const params = new URLSearchParams({ search, genre, status, sort });
    const response = await fetch(`/api/admin/anime?${params.toString()}`);
    const data = (await response.json()) as { animes?: Anime[]; genres?: Array<{ name: string; slug: string }>; error?: string };
    if (!response.ok) {
      setError(data.error ?? "Anime could not be loaded.");
      return;
    }
    setAnimes(data.animes ?? []);
    setGenres(data.genres ?? []);
  }

  useEffect(() => {
    const params = new URLSearchParams({ search, genre, status, sort });
    fetch(`/api/admin/anime?${params.toString()}`)
      .then(async (response) => {
        const data = (await response.json()) as { animes?: Anime[]; genres?: Array<{ name: string; slug: string }>; error?: string };
        if (!response.ok) {
          setError(data.error ?? "Anime could not be loaded.");
          return;
        }
        setAnimes(data.animes ?? []);
        setGenres(data.genres ?? []);
      })
      .catch(() => setError("Anime could not be loaded."));
  }, [search, genre, status, sort]);

  const visibleAnimes = useMemo(() => animes, [animes]);

  async function toggle(id: string, field: "published" | "featured" | "trending", value: boolean) {
    setError("");
    const response = await fetch("/api/admin/anime", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, [field]: value }),
    });
    if (!response.ok) setError("Anime setting could not be updated.");
    await load();
  }

  async function removeAnime(anime: Anime) {
    if (!window.confirm(`Delete ${anime.title}? This also removes its seasons, episodes, and related records.`)) return;
    const response = await fetch("/api/admin/anime", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: anime.id }),
    });
    if (!response.ok) setError("Anime could not be deleted.");
    await load();
  }

  return (
    <div>
      <header className="admin-page-header">
        <div><p>CONTENT LIBRARY</p><h1>Anime management</h1></div>
        <Link className="admin-primary-button" href="/admin/anime/new">+ Add anime</Link>
      </header>
      <div className="admin-toolbar">
        <label>Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search anime title" /></label>
        <label>Genre<select value={genre} onChange={(event) => setGenre(event.target.value)}><option value="">All genres</option>{genres.map((item) => <option value={item.slug} key={item.slug}>{item.name}</option>)}</select></label>
        <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="AIRING">Airing</option><option value="COMPLETED">Completed</option><option value="UPCOMING">Upcoming</option></select></label>
        <label>Sort<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="title">Title A-Z</option><option value="release-desc">Newest release year</option><option value="release-asc">Oldest release year</option><option value="newest">Newest added</option></select></label>
      </div>
      {error && <p className="admin-alert admin-alert--error" role="alert">{error}</p>}
      <div className="admin-table-wrap">
        <table className="admin-table admin-anime-table">
          <thead><tr><th>Anime</th><th>Year</th><th>Genre</th><th>Rating</th><th>Episodes</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {visibleAnimes.map((anime) => (
              <tr key={anime.id}>
                <td><div className="admin-anime-name"><Image src={anime.poster || "/images/anime-cover-placeholder.svg"} alt="" width={38} height={52} unoptimized /><strong>{anime.title}</strong><small>{anime.slug}</small>{(!anime.poster || anime.poster === "/images/anime-cover-placeholder.svg") && <small className="admin-missing-cover">Cover missing</small>}</div></td>
                <td>{anime.releaseYear}</td>
                <td>{anime.genres.map((entry) => entry.genre.name).join(", ") || "—"}</td>
                <td>{anime.rating.toFixed(1)}</td>
                <td>{anime._count.episodes}</td>
                <td>
                  <button className={anime.published ? "admin-badge admin-badge--live" : "admin-badge"} type="button" onClick={() => toggle(anime.id, "published", !anime.published)}>{anime.published ? "Published" : "Draft"}</button>
                  <button className="admin-badge" type="button" onClick={() => toggle(anime.id, "featured", !anime.featured)}>{anime.featured ? "Featured ✓" : "Feature"}</button>
                  <button className="admin-badge" type="button" onClick={() => toggle(anime.id, "trending", !anime.trending)}>{anime.trending ? "Trending ✓" : "Trend"}</button>
                </td>
                <td><div className="admin-row-actions"><Link href={`/admin/anime/${anime.id}/edit`}>Edit</Link><button type="button" onClick={() => removeAnime(anime)}>Delete</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visibleAnimes.length && <p className="admin-empty">No anime match these filters.</p>}
      </div>
    </div>
  );
}
