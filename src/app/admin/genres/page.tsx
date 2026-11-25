"use client";

import { useEffect, useState } from "react";

type Genre = { id: string; name: string; slug: string; _count: { animes: number } };

export default function AdminGenresPage() {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Genre | null>(null);

  async function load() {
    const response = await fetch("/api/admin/genres");
    if (response.ok) setGenres(((await response.json()) as { genres: Genre[] }).genres);
  }
  useEffect(() => {
    fetch("/api/admin/genres")
      .then(async (response) => {
        if (response.ok) {
          setGenres(((await response.json()) as { genres: Genre[] }).genres);
        }
      })
      .catch(() => setError("Genres could not be loaded."));
  }, []);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/admin/genres", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, slug }) });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) { setError(data.error ?? "Genre could not be added."); return; }
    setName(""); setSlug(""); setEditing(null); await load();
  }
  function editGenre(genre: Genre) {
    setEditing(genre);
    setName(genre.name);
    setSlug(genre.slug);
  }
  async function updateGenre(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setError("");
    const response = await fetch("/api/admin/genres", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editing.id, name, slug }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) { setError(data.error ?? "Genre could not be updated."); return; }
    setEditing(null); setName(""); setSlug(""); await load();
  }
  async function remove(genre: Genre) {
    if (!window.confirm(`Delete ${genre.name}? It will be removed from ${genre._count.animes} anime relationships.`)) return;
    await fetch("/api/admin/genres", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: genre.id }) });
    await load();
  }

  return (
    <div>
      <header className="admin-page-header"><div><p>TAXONOMY</p><h1>Genre management</h1></div></header>
      <form className="admin-inline-form" onSubmit={editing ? updateGenre : add}>
        {error && <p className="admin-alert admin-alert--error">{error}</p>}
        <label>Genre name<input value={name} onChange={(event) => setName(event.target.value)} onBlur={() => { if (!slug) setSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }} required /></label>
        <label>Slug<input value={slug} onChange={(event) => setSlug(event.target.value)} required /></label>
        <button className="admin-primary-button" type="submit">{editing ? "Save genre" : "Add genre"}</button>
      </form>
      <label className="admin-search">Search genres<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Genre name" /></label>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Genre</th><th>Slug</th><th>Anime</th><th>Actions</th></tr></thead><tbody>{genres.filter((genre) => genre.name.toLowerCase().includes(search.toLowerCase())).map((genre) => <tr key={genre.id}><td><strong>{genre.name}</strong></td><td>{genre.slug}</td><td>{genre._count.animes}</td><td><div className="admin-row-actions"><button type="button" onClick={() => editGenre(genre)}>Edit</button><button className="admin-danger-button" type="button" onClick={() => remove(genre)}>Delete</button></div></td></tr>)}</tbody></table></div>
    </div>
  );
}
