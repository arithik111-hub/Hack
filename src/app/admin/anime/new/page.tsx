"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useEffect, useState } from "react";

type Genre = { id: string; name: string };
type UploadedCover = { poster: string; slug: string };

export default function AddAnimePage() {
  const router = useRouter();
  const [genres, setGenres] = useState<Genre[]>([]);
  const [genreIds, setGenreIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [poster, setPoster] = useState("");
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverRemoving, setCoverRemoving] = useState(false);
  const [uploadedCover, setUploadedCover] = useState<UploadedCover | null>(null);
  const [coverNotice, setCoverNotice] = useState("");
  const [posterPreview, setPosterPreview] = useState("");
  const [bannerPreview, setBannerPreview] = useState("");

  useEffect(() => {
    fetch("/api/admin/genres").then(async (response) => {
      if (response.ok) setGenres(((await response.json()) as { genres: Genre[] }).genres);
    });
  }, []);

  async function deleteUploadedCover(cover: UploadedCover) {
    const response = await fetch("/api/admin/anime/cover", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cover),
    });
    const data = await response.json() as { error?: string };
    if (!response.ok) throw new Error(data.error ?? "Cover could not be removed from Supabase Storage.");
  }

  async function uploadCover(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    const slugInput = event.currentTarget.form?.elements.namedItem("slug") as HTMLInputElement | null;
    const slug = slugInput?.value.trim();
    if (!slug) {
      setError("Enter a unique slug before uploading the cover.");
      return;
    }

    setError("");
    setCoverNotice("");
    setCoverUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("slug", slug);
      const response = await fetch("/api/admin/anime/cover", {
        method: "POST",
        body: formData,
      });
      const data = await response.json() as { poster?: string; error?: string };
      if (!response.ok || !data.poster) throw new Error(data.error ?? "Cover image could not be uploaded.");
      const previousCover = uploadedCover;
      setPoster(data.poster);
      setPosterPreview(data.poster);
      setUploadedCover({ poster: data.poster, slug });
      setCoverNotice("Cover uploaded to Supabase Storage.");
      if (previousCover) {
        try {
          await deleteUploadedCover(previousCover);
        } catch {
          setCoverNotice("New cover uploaded. The previous unused cover is still in Supabase Storage.");
        }
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Cover image could not be uploaded.");
    } finally {
      setCoverUploading(false);
    }
  }

  async function removeCover() {
    setError("");
    setCoverRemoving(true);
    try {
      if (uploadedCover) await deleteUploadedCover(uploadedCover);
      setPoster("");
      setPosterPreview("");
      setUploadedCover(null);
      setCoverNotice(uploadedCover ? "Cover removed from Supabase Storage." : "Cover removed from the form.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Cover could not be removed.");
    } finally {
      setCoverRemoving(false);
    }
  }

  async function cancelAddAnime() {
    setError("");
    if (uploadedCover) {
      setCoverRemoving(true);
      try {
        await deleteUploadedCover(uploadedCover);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Cover could not be removed.");
        setCoverRemoving(false);
        return;
      }
      setCoverRemoving(false);
    }
    router.push("/admin/anime");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      title: form.get("title"),
      slug: form.get("slug"),
      alternativeTitle: form.get("alternativeTitle"),
      description: form.get("description"),
      poster,
      banner: form.get("banner"),
      releaseYear: form.get("releaseYear"),
      studio: form.get("studio"),
      status: form.get("status"),
      rating: form.get("rating"),
      totalEpisodes: form.get("totalEpisodes") || null,
      type: form.get("type"),
      languages: String(form.get("languages") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
      featured: form.get("featured") === "on",
      trending: form.get("trending") === "on",
      published: form.get("published") === "on",
      customPoster: Boolean(poster && /\/storage\/v1\/object\/public\/[^/]+\//.test(poster)),
      genreIds,
    };
    const response = await fetch("/api/admin/anime", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = (await response.json()) as { error?: string };
    setLoading(false);
    if (!response.ok) { setError(data.error ?? "Anime could not be created."); return; }
    router.push("/admin/anime");
  }

  return (
    <div>
      <header className="admin-page-header"><div><p>CONTENT LIBRARY</p><h1>Add anime</h1></div><button className="admin-secondary-button" type="button" onClick={() => void cancelAddAnime()} disabled={loading || coverUploading || coverRemoving}>Cancel</button></header>
      <form className="admin-form" onSubmit={submit}>
        {error && <p className="admin-alert admin-alert--error" role="alert">{error}</p>}
        <div className="admin-form-grid">
          <label>Anime title<input name="title" required onChange={(event) => {
            const slugInput = event.currentTarget.form?.elements.namedItem("slug") as HTMLInputElement | null;
            if (slugInput && !slugInput.dataset.manual) {
              slugInput.value = event.target.value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            }
          }} /></label>
          <label>Unique slug<input name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required onChange={(event) => { event.currentTarget.dataset.manual = "true"; }} /></label>
          <label>Japanese / alternative title<input name="alternativeTitle" /></label>
          <label>Studio<input name="studio" required /></label>
          <label>Release year<input name="releaseYear" type="number" min="1900" max="2100" required /></label>
          <label>Rating<input name="rating" type="number" min="0" max="10" step="0.1" defaultValue="0" required /></label>
          <label>Status<select name="status" defaultValue="COMPLETED"><option value="AIRING">Airing</option><option value="COMPLETED">Completed</option><option value="UPCOMING">Upcoming</option></select></label>
          <label>Type<select name="type" defaultValue="TV"><option>TV</option><option>Movie</option><option>OVA</option><option>ONA</option></select></label>
          <label>Total episodes<input name="totalEpisodes" type="number" min="1" /></label>
          <label>Languages<input name="languages" placeholder="Japanese, English dub" required /></label>
          <label className="admin-form-wide">Upload cover image<input type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={uploadCover} disabled={coverUploading || coverRemoving} /><small>PNG, JPEG, WebP, or AVIF. Maximum 10 MB. Uploads to public Supabase Storage.</small></label>
          {poster && <div className="admin-form-wide admin-cover-preview"><Image src={poster} alt="Cover preview" width={96} height={136} unoptimized />{coverUploading && <span role="status">Uploading cover...</span>}</div>}
          {coverNotice && <p className="admin-form-wide admin-alert" role="status">{coverNotice}</p>}
          {poster && <button className="admin-danger-button admin-form-wide" type="button" onClick={() => void removeCover()} disabled={coverUploading || coverRemoving}>{coverRemoving ? "Removing cover..." : "Remove cover"}</button>}
          <label className="admin-form-wide">Poster URL<input name="poster" type="url" value={poster} required onChange={(event) => { setPoster(event.target.value); setPosterPreview(event.target.value); }} /></label>
          <label className="admin-form-wide">Banner URL<input name="banner" type="url" required onChange={(event) => setBannerPreview(event.target.value)} /></label>
          <label className="admin-form-wide">Description<textarea name="description" required minLength={10} /></label>
        </div>
        {(posterPreview || bannerPreview) && (
          <div className="admin-image-previews" aria-label="Image previews">
            {posterPreview && <figure><Image src={posterPreview} alt="Poster preview" width={160} height={220} /><figcaption>Poster preview</figcaption></figure>}
            {bannerPreview && <figure><Image src={bannerPreview} alt="Banner preview" width={560} height={220} /><figcaption>Banner preview</figcaption></figure>}
          </div>
        )}
        <fieldset className="admin-checkbox-grid"><legend>Genres</legend>{genres.map((genre) => <label key={genre.id}><input type="checkbox" checked={genreIds.includes(genre.id)} onChange={(event) => setGenreIds((current) => event.target.checked ? [...current, genre.id] : current.filter((id) => id !== genre.id))} />{genre.name}</label>)}</fieldset>
        <div className="admin-toggles"><label><input name="published" type="checkbox" defaultChecked /> Published</label><label><input name="featured" type="checkbox" /> Featured</label><label><input name="trending" type="checkbox" /> Trending</label></div>
        <button className="admin-primary-button" type="submit" disabled={loading || coverUploading || coverRemoving}>{loading ? "Saving..." : "Save anime"}</button>
      </form>
    </div>
  );
}
