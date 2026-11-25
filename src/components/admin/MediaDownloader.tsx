"use client";

import { useEffect, useMemo, useState } from "react";

type Episode = {
  id: string;
  title: string;
  episodeNumber: number;
  anime: { id: string; title: string };
  season: { id: string; title: string; seasonNumber: number };
};

type Provider = "CLOUDFLARE_STREAM" | "BUNNY_STREAM" | "MUX";
type ProviderInfo = { configured: boolean; missing: string[] };
type JobStatus =
  | "QUEUED"
  | "DOWNLOADING"
  | "UPLOADING"
  | "PAUSED"
  | "FAILED"
  | "CANCELLED"
  | "SUCCEEDED";
type Job = {
  id: string;
  language: string;
  provider: Provider;
  status: JobStatus;
  sourceHost: string;
  authorizationNote: string;
  downloadProgress: number;
  uploadProgress: number;
  downloadedBytes: number;
  fileSize: number | null;
  providerAssetId: string | null;
  attempts: number;
  errorMessage: string | null;
  workerId: string | null;
  createdAt: string;
  episode: {
    title: string;
    episodeNumber: number;
    anime: { title: string };
    season: { title: string; seasonNumber: number };
  };
  videoSource: { isActive: boolean } | null;
};

type DashboardData = {
  episodes: Episode[];
  jobs: Job[];
  providers: Record<Provider, ProviderInfo>;
  allowedSourceHosts: string[];
  encryptionConfigured: boolean;
  workerCommand: string;
  maxFileSizeBytes: number;
};

const providerLabels: Record<Provider, string> = {
  CLOUDFLARE_STREAM: "Cloudflare Stream",
  BUNNY_STREAM: "Bunny Stream",
  MUX: "Mux",
};

const statusLabels: Record<JobStatus, string> = {
  QUEUED: "Queued",
  DOWNLOADING: "Downloading",
  UPLOADING: "Uploading",
  PAUSED: "Paused",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  SUCCEEDED: "Uploaded · approval needed",
};

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes <= 0) return "Unknown size";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit > 0 ? 1 : 0)} ${units[unit]}`;
}

export function MediaDownloader() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [animeId, setAnimeId] = useState("");
  const [seasonId, setSeasonId] = useState("");
  const [episodeId, setEpisodeId] = useState("");
  const [language, setLanguage] = useState("ja");
  const [provider, setProvider] = useState<Provider>("CLOUDFLARE_STREAM");
  const [sourceUrl, setSourceUrl] = useState("");
  const [authorizationNote, setAuthorizationNote] = useState("");
  const [authorizationConfirmed, setAuthorizationConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [busyJob, setBusyJob] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load(signal?: AbortSignal) {
    const response = await fetch("/api/admin/downloader", {
      cache: "no-store",
      signal,
    });
    const result = (await response.json()) as DashboardData & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "Media jobs could not be loaded.");
    setData(result);
    setProvider((current) =>
      result.providers[current].configured
        ? current
        : (Object.entries(result.providers).find(([, info]) => info.configured)?.[0] as Provider | undefined) ??
          current,
    );
  }

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        await load(controller.signal);
        if (active) setError("");
      } catch (reason) {
        if (active && !controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "Media jobs could not be loaded.");
        }
      } finally {
        if (active) {
          setLoading(false);
          timer = setTimeout(refresh, 3000);
        }
      }
    };
    void refresh();
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, []);

  const animeOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const episode of data?.episodes ?? []) map.set(episode.anime.id, episode.anime.title);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data?.episodes]);

  const seasons = useMemo(() => {
    const map = new Map<string, Episode["season"]>();
    for (const episode of data?.episodes ?? []) {
      if (episode.anime.id === animeId) map.set(episode.season.id, episode.season);
    }
    return [...map.entries()].sort((a, b) => a[1].seasonNumber - b[1].seasonNumber);
  }, [data?.episodes, animeId]);

  const episodes = useMemo(
    () =>
      (data?.episodes ?? []).filter(
        (episode) => episode.anime.id === animeId && episode.season.id === seasonId,
      ),
    [data?.episodes, animeId, seasonId],
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!episodeId || !authorizationConfirmed) {
      setError("Select an episode and confirm that you have redistribution rights.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/downloader", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          episodeId,
          language,
          provider,
          sourceUrl,
          authorizationNote,
          authorizationConfirmed,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The download job could not be created.");
      setMessage("Authorized import job added to the persistent queue.");
      setSourceUrl("");
      setAuthorizationNote("");
      setAuthorizationConfirmed(false);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The download job could not be created.");
    } finally {
      setSubmitting(false);
    }
  }

  async function runAction(job: Job, action: string, publishEpisode = false) {
    if (
      action === "cancel" &&
      !window.confirm(`Cancel the media import for ${job.episode.anime.title}?`)
    ) {
      return;
    }
    setError("");
    setMessage("");
    setBusyJob(job.id);
    try {
      const response = await fetch(`/api/admin/downloader/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, publishEpisode }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The job action failed.");
      setMessage(
        action === "approve"
          ? publishEpisode
            ? "Video approved and episode published."
            : "Video source approved. Episode publication was unchanged."
          : `Job ${action} request completed.`,
      );
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The job action failed.");
    } finally {
      setBusyJob("");
    }
  }

  const configuredProvider = data?.providers[provider]?.configured ?? false;
  const ready =
    Boolean(data?.allowedSourceHosts.length) &&
    Boolean(data?.encryptionConfigured) &&
    configuredProvider;

  return (
    <div className="media-downloader">
      {data && (
        <div className="admin-alert media-downloader__setup">
          <strong>Authorized direct-file imports only</strong>
          <p>
            Add exact hostnames to <code>MEDIA_ALLOWED_SOURCE_HOSTS</code>. Private
            addresses, non-HTTPS URLs, unsupported media, playlists, and redirects
            outside the allowlist are rejected. The worker streams files to local
            disk; they are never buffered in application memory or PostgreSQL.
          </p>
          <p>
            Start the persistent worker in a separate terminal with{" "}
            <code>{data.workerCommand}</code>. It uses database leases to recover
            interrupted downloads after restarts.
          </p>
          <p>
            Allowlisted sources:{" "}
            {data.allowedSourceHosts.length
              ? data.allowedSourceHosts.join(", ")
              : "none configured"}
            {" · "}Maximum file size: {formatBytes(data.maxFileSizeBytes)}
          </p>
        </div>
      )}

      <div className="admin-panel media-downloader__providers">
        <h2>Video provider configuration</h2>
        <div className="media-downloader__provider-list">
          {(Object.entries(providerLabels) as [Provider, string][]).map(([key, label]) => {
            const info = data?.providers[key];
            return (
              <div className="media-downloader__provider" key={key}>
                <strong>{label}</strong>
                <span className={info?.configured ? "admin-badge admin-badge--live" : "admin-badge"}>
                  {info?.configured ? "Configured" : "Not configured"}
                </span>
                {info && !info.configured && (
                  <small>Missing {info.missing.join(", ")}</small>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <form className="admin-form media-downloader__form" onSubmit={submit}>
        <div className="admin-form-grid">
          <label>
            Anime
            <select
              value={animeId}
              onChange={(event) => {
                setAnimeId(event.target.value);
                setSeasonId("");
                setEpisodeId("");
              }}
              required
            >
              <option value="">Choose anime</option>
              {animeOptions.map(([id, title]) => <option value={id} key={id}>{title}</option>)}
            </select>
          </label>
          <label>
            Season
            <select
              value={seasonId}
              onChange={(event) => {
                setSeasonId(event.target.value);
                setEpisodeId("");
              }}
              disabled={!animeId}
              required
            >
              <option value="">Choose season</option>
              {seasons.map(([id, season]) => (
                <option value={id} key={id}>Season {season.seasonNumber} · {season.title}</option>
              ))}
            </select>
          </label>
          <label>
            Episode
            <select value={episodeId} onChange={(event) => setEpisodeId(event.target.value)} disabled={!seasonId} required>
              <option value="">Choose episode</option>
              {episodes.map((episode) => (
                <option value={episode.id} key={episode.id}>
                  Episode {episode.episodeNumber} · {episode.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Video language
            <input
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              placeholder="ja, en, or ja-JP"
              maxLength={16}
              required
            />
          </label>
          <label>
            Video provider
            <select value={provider} onChange={(event) => setProvider(event.target.value as Provider)}>
              {(Object.entries(providerLabels) as [Provider, string][]).map(([key, label]) => (
                <option value={key} key={key}>{label}</option>
              ))}
            </select>
          </label>
          <label className="admin-form-wide">
            Authorized direct video URL
            <input
              type="url"
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://approved-host.example/path/video.mp4"
              maxLength={2048}
              autoComplete="off"
              required
            />
          </label>
          <label className="admin-form-wide">
            Authorization / redistribution basis
            <textarea
              value={authorizationNote}
              onChange={(event) => setAuthorizationNote(event.target.value)}
              minLength={15}
              maxLength={1000}
              placeholder="Record the license, permission, or ownership basis for this file."
              required
            />
          </label>
        </div>
        <label className="admin-check-line">
          <input
            type="checkbox"
            checked={authorizationConfirmed}
            onChange={(event) => setAuthorizationConfirmed(event.target.checked)}
            required
          />
          I confirm this is a direct download source, not a DRM-protected stream, and I have explicit rights to download and redistribute it.
        </label>
        {error && <p className="admin-alert admin-alert--error" role="alert">{error}</p>}
        {message && <p className="auth-success" role="status">{message}</p>}
        {!data?.encryptionConfigured && (
          <p className="admin-alert admin-alert--error" role="alert">
            Configure MEDIA_JOB_ENCRYPTION_KEY before queuing jobs.
          </p>
        )}
        <div className="admin-form-actions">
          <button className="admin-primary-button" type="submit" disabled={!ready || submitting || loading}>
            {submitting ? "Queueing…" : "Start authorized import"}
          </button>
        </div>
      </form>

      <section className="admin-table-wrap">
        <div className="media-downloader__table-title">
          <div><h2>Import jobs</h2><p>Progress refreshes automatically. Source URLs and provider credentials are never returned.</p></div>
          <button className="admin-secondary-button" type="button" onClick={() => void load().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Refresh failed."))}>
            Refresh
          </button>
        </div>
        {error && !data && <p className="admin-alert admin-alert--error" role="alert">{error}</p>}
        {loading && <p className="admin-empty" role="status">Loading media jobs…</p>}
        {!loading && data && !data.jobs.length && (
          <p className="admin-empty">No media import jobs yet. Jobs require an allowlisted source and configured upload provider.</p>
        )}
        {data && data.jobs.length > 0 && (
          <table className="admin-table">
            <thead>
              <tr><th>Episode</th><th>Source / provider</th><th>Status</th><th>Progress</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {data.jobs.map((job) => {
                const busy = busyJob === job.id;
                return (
                  <tr key={job.id}>
                    <td>
                      <strong>{job.episode.anime.title}</strong>
                      <small>
                        S{job.episode.season.seasonNumber} · E{job.episode.episodeNumber} · {job.episode.title} · {job.language}
                      </small>
                    </td>
                    <td>
                      <strong>{providerLabels[job.provider]}</strong>
                      <small>{job.sourceHost} · {formatBytes(job.fileSize ?? job.downloadedBytes)}</small>
                      {job.providerAssetId && <small>Provider asset: {job.providerAssetId}</small>}
                    </td>
                    <td>
                      <span className={`admin-badge ${job.status === "SUCCEEDED" ? "admin-badge--live" : ""}`}>
                        {statusLabels[job.status]}
                      </span>
                      {job.errorMessage && <small className="media-downloader__error">{job.errorMessage}</small>}
                      {job.status === "FAILED" && <small>Attempt {job.attempts} of 3</small>}
                      {job.status === "SUCCEEDED" && !job.videoSource?.isActive && <small>Source disabled until approval</small>}
                    </td>
                    <td>
                      <div className="media-downloader__progress">
                        <label htmlFor={`download-${job.id}`}>Download</label>
                        <progress id={`download-${job.id}`} max={100} value={job.downloadProgress} />
                        <small>{job.downloadProgress}%</small>
                      </div>
                      <div className="media-downloader__progress">
                        <label htmlFor={`upload-${job.id}`}>Upload</label>
                        <progress id={`upload-${job.id}`} max={100} value={job.uploadProgress} />
                        <small>{job.uploadProgress}%</small>
                      </div>
                    </td>
                    <td>
                      <div className="admin-row-actions media-downloader__actions">
                        {["QUEUED", "DOWNLOADING"].includes(job.status) && (
                          <button type="button" disabled={busy} onClick={() => void runAction(job, "pause")}>Pause</button>
                        )}
                        {job.status === "PAUSED" && !job.workerId && (
                          <button type="button" disabled={busy} onClick={() => void runAction(job, "resume")}>Resume</button>
                        )}
                        {["QUEUED", "DOWNLOADING", "UPLOADING", "PAUSED"].includes(job.status) && (
                          <button type="button" disabled={busy} onClick={() => void runAction(job, "cancel")}>Cancel</button>
                        )}
                        {job.status === "FAILED" && job.attempts < 3 && !job.providerAssetId && (
                          <button type="button" disabled={busy} onClick={() => void runAction(job, "retry")}>Retry</button>
                        )}
                        {job.status === "SUCCEEDED" && !job.videoSource?.isActive && (
                          <>
                            <button type="button" disabled={busy} onClick={() => void runAction(job, "approve")}>Approve source</button>
                            <button type="button" disabled={busy} onClick={() => void runAction(job, "approve", true)}>Approve & publish episode</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
