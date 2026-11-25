"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Genre = { id: string; name: string };
type Anime = {
  id: string; title: string; slug: string; alternativeTitle: string | null; description: string;
  poster: string; banner: string; releaseYear: number; studio: string; status: "AIRING" | "COMPLETED" | "UPCOMING";
  rating: number; totalEpisodes: number | null; type: string; languages: string[]; featured: boolean; trending: boolean;
  published: boolean; genreIds: string[]; metadataSource: "MANUAL" | "ANILIST" | "JIKAN" | "KITSU";
  anilistId: number | null; jikanId: number | null; kitsuId: string | null; lastSyncedAt: string | null;
};

export function EditAnimeForm({ anime, genres }: { anime: Anime; genres: Genre[] }) {
  const router = useRouter();
  const [genreIds, setGenreIds] = useState(anime.genreIds);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [poster, setPoster] = useState(anime.poster);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverRemoving, setCoverRemoving] = useState(false);
  const [coverNotice, setCoverNotice] = useState("");
  const [syncing, setSyncing] = useState(false);

  async function uploadCover(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    setError("");
    setCoverNotice("");
    setCoverUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/admin/anime/${encodeURIComponent(anime.id)}/cover`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json() as { poster?: string; warning?: string; error?: string };
      if (!response.ok || !data.poster) throw new Error(data.error ?? "Cover image could not be uploaded.");
      setPoster(data.poster);
      setCoverNotice(data.warning ?? "Cover uploaded to Supabase Storage.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Cover image could not be uploaded.");
    } finally {
      setCoverUploading(false);
    }
  }

  async function removeCover() {
    setError("");
    setCoverNotice("");
    setCoverRemoving(true);
    try {
      const response = await fetch(`/api/admin/anime/${encodeURIComponent(anime.id)}/cover`, {
        method: "DELETE",
      });
      const data = await response.json() as { poster?: string; error?: string };
      if (!response.ok || !data.poster) throw new Error(data.error ?? "Cover could not be removed.");
      setPoster(data.poster);
      setCoverNotice("Cover removed from Supabase Storage.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Cover could not be removed.");
    } finally {
      setCoverRemoving(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      id: anime.id,
      title: form.get("title"), slug: form.get("slug"), alternativeTitle: form.get("alternativeTitle"),
      description: form.get("description"), poster, banner: form.get("banner"),
      releaseYear: form.get("releaseYear"), studio: form.get("studio"), status: form.get("status"),
      rating: form.get("rating"), totalEpisodes: form.get("totalEpisodes") || null,
      type: form.get("type"), languages: String(form.get("languages") ?? "").split(",").map((v) => v.trim()).filter(Boolean),
      featured: form.get("featured") === "on", trending: form.get("trending") === "on",
      published: form.get("published") === "on", genreIds,
    };
    const response = await fetch("/api/admin/anime", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = (await response.json()) as { error?: string };
    setLoading(false);
    if (!response.ok) { setError(data.error ?? "Anime could not be updated."); return; }
    router.push("/admin/anime");
  }

  async function removeAnime() {
    if (!window.confirm("Delete this anime? This permanently removes related seasons and episodes. This action cannot be undone.")) return;
    const response = await fetch("/api/admin/anime", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: anime.id }) });
    if (response.ok) router.push("/admin/anime");
    else setError("Anime could not be deleted.");
  }

  async function syncMetadata() {
    setError("");
    setSyncing(true);
    try {
      const response = await fetch("/api/admin/import/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animeId: anime.id }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Metadata could not be synchronized.");
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Metadata could not be synchronized.");
      setSyncing(false);
    }
  }

  const hasProviderId = Boolean(anime.anilistId || anime.jikanId || anime.kitsuId);

  return (
    <div>
      <header className="admin-page-header"><div><p>CONTENT LIBRARY</p><h1>Edit anime</h1></div><Link className="admin-secondary-button" href="/admin/anime">Cancel</Link></header>
      <form className="admin-form" onSubmit={submit}>
        {error && <p className="admin-alert admin-alert--error" role="alert">{error}</p>}
        <div className="admin-form-wide">
          <p>Metadata source: {anime.metadataSource}</p>
          <p>Last synchronized: {anime.lastSyncedAt ? new Date(anime.lastSyncedAt).toLocaleString() : "Never"}</p>
          <button className="admin-secondary-button" type="button" onClick={() => void syncMetadata()} disabled={!hasProviderId || syncing}>
            {syncing ? "Synchronizing..." : "Refresh metadata"}
          </button>
        </div>
        <div className="admin-form-grid">
          <label>Anime title<input name="title" defaultValue={anime.title} required /></label>
          <label>Unique slug<input name="slug" defaultValue={anime.slug} required /></label>
          <label>Japanese / alternative title<input name="alternativeTitle" defaultValue={anime.alternativeTitle ?? ""} /></label>
          <label>Studio<input name="studio" defaultValue={anime.studio} required /></label>
          <label>Release year<input name="releaseYear" type="number" defaultValue={anime.releaseYear} required /></label>
          <label>Rating<input name="rating" type="number" min="0" max="10" step="0.1" defaultValue={anime.rating} required /></label>
          <label>Status<select name="status" defaultValue={anime.status}><option value="AIRING">Airing</option><option value="COMPLETED">Completed</option><option value="UPCOMING">Upcoming</option></select></label>
          <label>Type<select name="type" defaultValue={anime.type}><option>TV</option><option>Movie</option><option>OVA</option><option>ONA</option></select></label>
          <label>Total episodes<input name="totalEpisodes" type="number" defaultValue={anime.totalEpisodes ?? ""} /></label>
          <label>Languages<input name="languages" defaultValue={anime.languages.join(", ")} required /></label>
          <label className="admin-form-wide">Upload cover image<input type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={uploadCover} disabled={coverUploading || coverRemoving} /><small>PNG, JPEG, WebP, or AVIF. Maximum 10 MB. Uploads to public Supabase Storage.</small></label>
          {poster && (
            <div className="admin-form-wide admin-cover-preview">
              <Image src={poster} alt={`${anime.title} cover preview`} width={96} height={136} unoptimized />
              {coverUploading && <span role="status">Uploading cover...</span>}
              {poster.includes("/storage/v1/object/public/") && <button className="admin-danger-button" type="button" onClick={() => void removeCover()} disabled={coverUploading || coverRemoving}>{coverRemoving ? "Removing cover..." : "Remove cover"}</button>}
            </div>
          )}
          {coverNotice && <p className="admin-form-wide admin-alert" role="status">{coverNotice}</p>}
          <label className="admin-form-wide">Poster URL<input name="poster" type="text" value={poster} onChange={(event) => setPoster(event.target.value)} required /></label>
          <label className="admin-form-wide">Banner URL<input name="banner" type="url" defaultValue={anime.banner} required /></label>
          <label className="admin-form-wide">Description<textarea name="description" defaultValue={anime.description} required /></label>
        </div>
        <fieldset className="admin-checkbox-grid"><legend>Genres</legend>{genres.map((genre) => <label key={genre.id}><input type="checkbox" checked={genreIds.includes(genre.id)} onChange={(event) => setGenreIds((current) => event.target.checked ? [...current, genre.id] : current.filter((id) => id !== genre.id))} />{genre.name}</label>)}</fieldset>
        <div className="admin-toggles"><label><input name="published" type="checkbox" defaultChecked={anime.published} /> Published</label><label><input name="featured" type="checkbox" defaultChecked={anime.featured} /> Featured</label><label><input name="trending" type="checkbox" defaultChecked={anime.trending} /> Trending</label></div>
        <div className="admin-form-actions"><button className="admin-primary-button" type="submit" disabled={loading || coverUploading || coverRemoving}>{loading ? "Saving..." : "Save changes"}</button><button className="admin-danger-button" type="button" onClick={removeAnime}>Delete anime</button></div>
      </form>
    </div>
  );
}
