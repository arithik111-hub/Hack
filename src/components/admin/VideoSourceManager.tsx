"use client";

import { useEffect, useState } from "react";

type Episode = {
  id: string;
  title: string;
  episodeNumber: number;
  anime: { title: string };
  season: { title: string };
};

type VideoSource = {
  id: string;
  provider: string;
  sourceType: string;
  playbackReference: string;
  isActive: boolean;
  episode: {
    title: string;
    episodeNumber: number;
    anime: { title: string };
  };
};

export function VideoSourceManager() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [sources, setSources] = useState<VideoSource[]>([]);
  const [episodeId, setEpisodeId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [provider, setProvider] = useState("");
  const [sourceType, setSourceType] = useState("EMBED");
  const [playbackReference, setPlaybackReference] = useState("");
  const [bucket, setBucket] = useState("");
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/admin/video-sources");
    const data = (await response.json()) as {
      episodes?: Episode[];
      sources?: VideoSource[];
      bucket?: string;
      bucketConfigured?: boolean;
      error?: string;
    };
    if (!response.ok) {
      setError(data.error ?? "Video sources could not be loaded.");
      return;
    }
    setEpisodes(data.episodes ?? []);
    setSources(data.sources ?? []);
    setBucket(data.bucket ?? "");
    setConfigured(data.bucketConfigured ?? false);
  }

  useEffect(() => {
    fetch("/api/admin/video-sources")
      .then(async (response) => {
        const data = (await response.json()) as {
          episodes?: Episode[];
          sources?: VideoSource[];
          bucket?: string;
          bucketConfigured?: boolean;
          error?: string;
        };
        if (!response.ok) {
          setError(data.error ?? "Video sources could not be loaded.");
          return;
        }
        setEpisodes(data.episodes ?? []);
        setSources(data.sources ?? []);
        setBucket(data.bucket ?? "");
        setConfigured(data.bucketConfigured ?? false);
      })
      .catch(() => setError("Video source data could not be loaded."));
  }, []);

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!episodeId || !file) {
      setError("Choose an episode and video file.");
      return;
    }
    setLoading(true);
    const form = new FormData();
    form.set("episodeId", episodeId);
    form.set("file", file);
    const response = await fetch("/api/admin/video-sources", {
      method: "POST",
      body: form,
    });
    const data = (await response.json()) as { error?: string; message?: string };
    setLoading(false);
    if (!response.ok) {
      setError(data.error ?? "Video upload failed.");
      return;
    }
    setMessage(data.message ?? "Video uploaded.");
    setFile(null);
    await load();
  }

  async function removeSource(source: VideoSource) {
    if (!window.confirm(`Remove the ${source.provider} source for ${source.episode.title}?`)) {
      return;
    }
    setError("");
    setMessage("");
    const response = await fetch("/api/admin/video-sources", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: source.id }),
    });
    if (!response.ok) {
      setError("The video source could not be removed.");
      return;
    }
    setMessage("Video source removed.");
    await load();
  }

  async function saveManualSource(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!episodeId || !provider.trim() || !playbackReference.trim()) {
      setError("Choose an episode and enter provider and playback reference.");
      return;
    }
    const response = await fetch("/api/admin/video-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        episodeId,
        provider,
        sourceType,
        playbackReference,
        isActive: true,
      }),
    });
    const data = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setError(data.error ?? "Video source could not be saved.");
      return;
    }
    setMessage(data.message ?? "Authorized source saved.");
    setProvider("");
    setPlaybackReference("");
    await load();
  }

  async function toggleSource(source: VideoSource) {
    setError("");
    setMessage("");
    const response = await fetch("/api/admin/video-sources", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: source.id, isActive: !source.isActive }),
    });
    if (!response.ok) {
      setError("Video source status could not be updated.");
      return;
    }
    await load();
  }

  return (
    <div>
      <div className="admin-alert">
        <strong>{configured ? `Supabase bucket: ${bucket}` : "Supabase storage not configured"}</strong>
        <p>
          Create a private Supabase Storage bucket, add its URL and service-role key to server environment variables,
          and upload only licensed or explicitly authorized video files. Do not use public protected content.
        </p>
      </div>

      <form className="admin-upload-form" onSubmit={upload}>
        <label>
          Episode
          <select value={episodeId} onChange={(event) => setEpisodeId(event.target.value)} required>
            <option value="">Choose an episode</option>
            {episodes.map((episode) => (
              <option value={episode.id} key={episode.id}>
                {episode.anime.title} · {episode.season.title} · Episode {episode.episodeNumber} — {episode.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Video file
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            required
          />
        </label>
        {error && <p className="admin-alert admin-alert--error" role="alert">{error}</p>}
        {message && <p className="auth-success" role="status">{message}</p>}
        <button className="admin-primary-button" type="submit" disabled={!configured || loading}>
          {loading ? "Uploading..." : "Upload to Supabase"}
        </button>
      </form>

      <form className="admin-upload-form" onSubmit={saveManualSource}>
        <label>
          Episode
          <select value={episodeId} onChange={(event) => setEpisodeId(event.target.value)} required>
            <option value="">Choose an episode</option>
            {episodes.map((episode) => (
              <option value={episode.id} key={`manual-${episode.id}`}>
                {episode.anime.title} · {episode.season.title} · Episode {episode.episodeNumber} — {episode.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Provider
          <input value={provider} onChange={(event) => setProvider(event.target.value)} placeholder="Licensed provider name" required />
        </label>
        <label>
          Source type
          <select value={sourceType} onChange={(event) => setSourceType(event.target.value)}>
            <option value="EMBED">Embed</option>
            <option value="HLS">HLS reference</option>
            <option value="MP4">MP4 URL</option>
            <option value="OTHER">Other authorized reference</option>
          </select>
        </label>
        <label>
          Permitted playback URL or provider reference
          <input value={playbackReference} onChange={(event) => setPlaybackReference(event.target.value)} placeholder="https://licensed-provider.example/player/..." required />
        </label>
        {error && <p className="admin-alert admin-alert--error" role="alert">{error}</p>}
        {message && <p className="auth-success" role="status">{message}</p>}
        <button className="admin-primary-button" type="submit">Save authorized source</button>
      </form>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Episode</th>
              <th>Provider</th>
              <th>Type</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.id}>
                <td>
                  <strong>{source.episode.anime.title}</strong>
                  <small>{source.episode.title} · Episode {source.episode.episodeNumber}</small>
                </td>
                <td>{source.provider}</td>
                <td>{source.sourceType}</td>
                <td>
                  <button className="admin-badge" type="button" onClick={() => toggleSource(source)}>
                    {source.isActive ? "Disable" : "Enable"}
                  </button>
                </td>
                <td>
                  <button className="admin-danger-button" type="button" onClick={() => removeSource(source)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!sources.length && <p className="admin-empty">No authorized video sources configured.</p>}
      </div>
    </div>
  );
}
