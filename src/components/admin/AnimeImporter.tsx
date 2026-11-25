"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { AnimeCatalogueFilter } from "@/lib/anilist/client";
import type { AnimeMetadata, MetadataProvider } from "@/lib/anime-metadata";

type Duplicate = { id: string; title: string; slug: string } | null;
type SearchResult = AnimeMetadata & { duplicate: Duplicate };
type Preview = AnimeMetadata & { duplicate: Duplicate };

type ImportFields = {
  title: string;
  romajiTitle: string;
  japaneseTitle: string;
  slug: string;
  alternativeTitle: string;
  description: string;
  poster: string;
  banner: string;
  releaseYear: string;
  season: string;
  durationMinutes: string;
  sourceMaterial: string;
  officialWebsite: string;
  studio: string;
  status: string;
  rating: string;
  popularity: string;
  totalEpisodes: string;
  type: string;
  languages: string;
  genres: string;
};

const filters: Array<{ value: AnimeCatalogueFilter; label: string }> = [
  { value: "all", label: "Search by title" },
  { value: "popular", label: "Popular anime" },
  { value: "recent", label: "Recently released" },
  { value: "airing", label: "Currently airing" },
  { value: "completed", label: "Completed anime" },
  { value: "upcoming", label: "Upcoming anime" },
  { value: "movies", label: "Movies" },
  { value: "tv", label: "TV series" },
];

const placeholderCover = "/images/anime-cover-placeholder.svg";

function SearchPoster({ src, title }: { src: string | null; title: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <Image
      src={!failed && src ? src : placeholderCover}
      alt={`${title} cover`}
      width={58}
      height={82}
      unoptimized
      onError={() => setFailed(true)}
    />
  );
}

function PreviewBanner({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <Image
      src={!failed ? src : placeholderCover}
      alt=""
      fill
      sizes="(max-width: 700px) 90vw, 900px"
      unoptimized
      onError={() => setFailed(true)}
    />
  );
}

function slugify(value: string) {
  return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function initialFields(media: AnimeMetadata): ImportFields {
  return {
    title: media.title,
    romajiTitle: media.romajiTitle ?? "",
    japaneseTitle: media.japaneseTitle ?? "",
    slug: slugify(media.title),
    alternativeTitle: media.alternativeTitle ?? "",
    description: media.description,
    poster: media.poster ?? placeholderCover,
    banner: media.banner ?? media.poster ?? placeholderCover,
    releaseYear: media.releaseYear?.toString() ?? "",
    season: media.season?.toUpperCase() ?? "",
    durationMinutes: media.durationMinutes?.toString() ?? "",
    sourceMaterial: media.sourceMaterial ?? "",
    officialWebsite: media.officialWebsite ?? "",
    studio: media.studio ?? "",
    status: media.status ?? "",
    rating: media.rating?.toFixed(1) ?? "",
    popularity: media.popularity?.toString() ?? "0",
    totalEpisodes: media.totalEpisodes?.toString() ?? "",
    type: media.type ?? "",
    languages: "",
    genres: media.genres.join(", "),
  };
}

function providerLabel(provider: MetadataProvider) {
  switch (provider) {
    case "ANILIST":
      return "AniList";
    case "JIKAN":
      return "Jikan";
    case "KITSU":
      return "Kitsu";
  }
}

function sourceUrl(media: AnimeMetadata) {
  switch (media.provider) {
    case "ANILIST":
      return `https://anilist.co/anime/${media.anilistId ?? media.providerId}`;
    case "JIKAN":
      return `https://myanimelist.net/anime/${media.jikanId ?? media.providerId}`;
    case "KITSU":
      return `https://kitsu.io/anime/${media.kitsuId ?? media.providerId}`;
  }
}

function optionalNumber(value: string) {
  return value.trim() ? Number(value) : null;
}

function selectedFilter(value: string) {
  return filters.find((option) => option.value === value)?.value ?? "all";
}

export default function AnimeImporter() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AnimeCatalogueFilter>("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<Preview | null>(null);
  const [fields, setFields] = useState<ImportFields | null>(null);
  const [publishAfterImport, setPublishAfterImport] = useState(true);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSelected(null);
    setFields(null);
    setLoadingSearch(true);
    try {
      const params = new URLSearchParams({ filter });
      if (query.trim()) params.set("q", query.trim());
      const response = await fetch(`/api/admin/import/search?${params}`);
      const data = await response.json() as {
        results?: SearchResult[];
        warning?: string | null;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Anime search failed.");
      setResults(data.results ?? []);
      if (data.warning) setNotice(data.warning);
      else if (!data.results?.length) setNotice("No matching anime found.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Anime search failed.");
      setResults([]);
    } finally {
      setLoadingSearch(false);
    }
  }

  async function openDetails(result: SearchResult) {
    setSelected(result);
    setFields(null);
    setError("");
    setNotice("");
    setLoadingDetails(true);
    try {
      const params = new URLSearchParams({
        provider: result.provider,
        id: result.providerId,
        title: result.title,
      });
      if (result.anilistId) params.set("anilistId", String(result.anilistId));
      if (result.jikanId) params.set("jikanId", String(result.jikanId));
      if (result.kitsuId) params.set("kitsuId", result.kitsuId);
      const response = await fetch(`/api/admin/import/details?${params}`);
      const data = await response.json() as {
        media?: AnimeMetadata;
        existing?: Duplicate;
        warning?: string | null;
        error?: string;
      };
      if (!response.ok || !data.media) {
        throw new Error(data.error ?? "Anime details could not be loaded.");
      }
      const preview = { ...data.media, duplicate: data.existing ?? result.duplicate };
      setSelected(preview);
      setFields(initialFields(data.media));
      setPublishAfterImport(true);
      if (data.warning) setNotice(data.warning);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Anime details could not be loaded.");
    } finally {
      setLoadingDetails(false);
    }
  }

  function updateField(name: keyof ImportFields, value: string) {
    setFields((current) => current ? { ...current, [name]: value } : current);
  }

  async function importAnime(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !fields) return;
    setSaving(true);
    setError("");
    setNotice("");
    const payload = {
      provider: selected.provider,
      providerId: selected.providerId,
      providerTitle: selected.title,
      anilistId: selected.anilistId,
      jikanId: selected.jikanId,
      kitsuId: selected.kitsuId,
      ...fields,
      releaseYear: Number(fields.releaseYear),
      season: fields.season || null,
      durationMinutes: optionalNumber(fields.durationMinutes),
      sourceMaterial: fields.sourceMaterial || null,
      officialWebsite: fields.officialWebsite || null,
      rating: Number(fields.rating),
      popularity: Number(fields.popularity) || 0,
      totalEpisodes: optionalNumber(fields.totalEpisodes),
      languages: fields.languages.split(",").map((value) => value.trim()).filter(Boolean),
      genres: fields.genres.split(",").map((value) => value.trim()).filter(Boolean),
      published: publishAfterImport,
    };

    try {
      const response = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as {
        anime?: { id: string; title: string; slug: string; published: boolean };
        error?: string;
      };
      if (!response.ok || !data.anime) throw new Error(data.error ?? "Import failed.");
      setNotice(
        data.anime.published
          ? `${data.anime.title} imported and published to the public catalogue.`
          : `${data.anime.title} imported as a draft.`,
      );
      setResults((current) => current.map((item) =>
        item.provider === selected.provider && item.providerId === selected.providerId
          ? { ...item, duplicate: { id: data.anime!.id, title: data.anime!.title, slug: data.anime!.slug } }
          : item,
      ));
      setSelected(null);
      setFields(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Import failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="jikan-importer">
      <header className="admin-page-header">
        <div><p>CATALOGUE TOOLS</p><h1>Anime Importer</h1></div>
        <Link className="admin-secondary-button" href="/admin/anime">Manage anime</Link>
      </header>
      <p className="jikan-importer__intro">
        Search and preview free metadata from AniList, Jikan, and Kitsu. AniList is tried first, with automatic fallback to Jikan and then Kitsu.
      </p>
      <form className="jikan-search" onSubmit={search}>
        <label htmlFor="anime-import-query">Anime title or catalogue filter</label>
        <div>
          <input
            id="anime-import-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            minLength={query ? 2 : 0}
            maxLength={80}
            placeholder="Search title, e.g. Frieren"
            required={filter === "all"}
          />
          <select aria-label="Catalogue filter" value={filter} onChange={(event) => setFilter(selectedFilter(event.target.value))}>
            {filters.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
          </select>
          <button className="admin-primary-button" disabled={loadingSearch}>
            {loadingSearch ? "Searching..." : "Search catalogue"}
          </button>
        </div>
      </form>

      {error && <p className="admin-alert admin-alert--error" role="alert">{error}</p>}
      {notice && <p className="admin-alert" role="status">{notice}</p>}

      {results.length > 0 && (
        <section className="jikan-results" aria-label="Anime search results">
          {results.map((result) => (
            <article
              className={`jikan-result ${selected?.provider === result.provider && selected.providerId === result.providerId ? "is-selected" : ""}`}
              key={`${result.provider}:${result.providerId}`}
            >
              <SearchPoster src={result.poster} title={result.title} />
              <div className="jikan-result__body">
                <h2>{result.title || "Untitled anime"}</h2>
                <p>{result.romajiTitle ?? result.japaneseTitle ?? "Alternative title unavailable"}{result.releaseYear ? ` · ${result.releaseYear}` : ""}{result.type ? ` · ${result.type}` : ""} · {providerLabel(result.provider)}</p>
                {result.duplicate && (
                  <p className="jikan-duplicate">
                    Existing record: <Link href={`/admin/anime/${result.duplicate.id}/edit`}>{result.duplicate.title}</Link>
                  </p>
                )}
              </div>
              <button
                className="admin-secondary-button"
                type="button"
                disabled={Boolean(result.duplicate)}
                onClick={() => void openDetails(result)}
              >
                {result.duplicate ? "Already imported" : "Preview"}
              </button>
            </article>
          ))}
        </section>
      )}

      {loadingDetails && <p className="admin-empty" role="status">Loading full metadata from the selected provider...</p>}
      {selected && fields && (
        <form className="admin-form jikan-preview" onSubmit={importAnime}>
          <div className="jikan-preview__heading">
            <div><p>PREVIEW AND EDIT</p><h2>{fields.title || "Anime metadata"}</h2></div>
            <span className="admin-badge">{publishAfterImport ? "Publish on import" : "Save as draft"}</span>
          </div>
          <div className="jikan-preview__art">
            <PreviewBanner src={fields.banner || placeholderCover} />
          </div>
          {selected.duplicate && (
            <p className="admin-alert admin-alert--error" role="alert">
              This anime is already connected to <Link href={`/admin/anime/${selected.duplicate.id}/edit`}>{selected.duplicate.title}</Link>.
            </p>
          )}
          <div className="admin-form-grid">
            <label>Display title<input value={fields.title} onChange={(event) => updateField("title", event.target.value)} required maxLength={160} /></label>
            <label>URL slug<input value={fields.slug} onChange={(event) => updateField("slug", event.target.value)} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={160} /></label>
            <label>Romaji title<input value={fields.romajiTitle} onChange={(event) => updateField("romajiTitle", event.target.value)} maxLength={300} /></label>
            <label>Japanese title<input value={fields.japaneseTitle} onChange={(event) => updateField("japaneseTitle", event.target.value)} maxLength={300} /></label>
            <label>Alternative titles<input value={fields.alternativeTitle} onChange={(event) => updateField("alternativeTitle", event.target.value)} maxLength={500} /></label>
            <label>Studio<input value={fields.studio} onChange={(event) => updateField("studio", event.target.value)} required maxLength={300} /></label>
            <label>Release year<input type="number" min="1900" max="2100" value={fields.releaseYear} onChange={(event) => updateField("releaseYear", event.target.value)} required /></label>
            <label>Season<select value={fields.season} onChange={(event) => updateField("season", event.target.value)}><option value="">Unknown / not set</option><option value="WINTER">Winter</option><option value="SPRING">Spring</option><option value="SUMMER">Summer</option><option value="FALL">Fall</option></select></label>
            <label>Rating / 10<input type="number" min="0" max="10" step="0.1" value={fields.rating} onChange={(event) => updateField("rating", event.target.value)} required /></label>
            <label>Popularity score<input type="number" min="0" max="2000000000" value={fields.popularity} onChange={(event) => updateField("popularity", event.target.value)} required /></label>
            <label>Status<select value={fields.status} onChange={(event) => updateField("status", event.target.value)} required><option value="">Select status</option><option value="AIRING">Airing</option><option value="COMPLETED">Completed</option><option value="UPCOMING">Upcoming</option></select></label>
            <label>Format<select value={fields.type} onChange={(event) => updateField("type", event.target.value)} required><option value="">Select format</option><option value="TV">TV series</option><option value="Movie">Movie</option><option value="OVA">OVA</option><option value="ONA">ONA</option></select></label>
            <label>Episodes<input type="number" min="0" max="10000" value={fields.totalEpisodes} onChange={(event) => updateField("totalEpisodes", event.target.value)} /></label>
            <label>Episode duration (minutes)<input type="number" min="1" max="1200" value={fields.durationMinutes} onChange={(event) => updateField("durationMinutes", event.target.value)} /></label>
            <label>Source material<input value={fields.sourceMaterial} onChange={(event) => updateField("sourceMaterial", event.target.value)} maxLength={120} /></label>
            <label>Languages (comma-separated)<input value={fields.languages} onChange={(event) => updateField("languages", event.target.value)} placeholder="Only enter known languages" /></label>
            <label className="admin-form-wide">Official website<input type="url" value={fields.officialWebsite} onChange={(event) => updateField("officialWebsite", event.target.value)} /></label>
            <label className="admin-form-wide">Poster URL<input value={fields.poster} onChange={(event) => updateField("poster", event.target.value)} required /></label>
            <label className="admin-form-wide">Banner URL<input value={fields.banner} onChange={(event) => updateField("banner", event.target.value)} required /></label>
            <label className="admin-form-wide">Genres (comma-separated)<input value={fields.genres} onChange={(event) => updateField("genres", event.target.value)} /></label>
            <label className="admin-form-wide">Description<textarea value={fields.description} onChange={(event) => updateField("description", event.target.value)} required minLength={10} maxLength={5000} /></label>
          </div>
          <p className="jikan-preview__note">
            Provider episode counts are metadata only. Import does not create season records, episode entries, video URLs, or streaming sources.
            External artwork URLs are retained at their original provider.
          </p>
          <label className="anime-import-publish">
            <input type="checkbox" checked={publishAfterImport} onChange={(event) => setPublishAfterImport(event.target.checked)} />
            Publish this anime to the public catalogue after import
          </label>
          <div className="admin-form-actions">
            <button className="admin-primary-button" type="submit" disabled={saving || Boolean(selected.duplicate)}>
              {saving ? "Importing..." : publishAfterImport ? "Import and publish" : "Import as draft"}
            </button>
            <button className="admin-secondary-button" type="button" onClick={() => { setSelected(null); setFields(null); }}>Cancel</button>
          </div>
          <p className="jikan-attribution">
            Metadata and artwork sourced from <a href={sourceUrl(selected)} target="_blank" rel="noreferrer">{providerLabel(selected.provider)}</a>.
            {" "}IDs: AniList {selected.anilistId ?? "—"} · MAL {selected.jikanId ?? "—"} · Kitsu {selected.kitsuId ?? "—"}.
          </p>
        </form>
      )}
    </div>
  );
}
