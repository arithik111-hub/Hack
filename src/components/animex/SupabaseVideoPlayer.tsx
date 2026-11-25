"use client";

import { useEffect, useRef, useState } from "react";

export function SupabaseVideoPlayer({ episodeId, title }: { episodeId: string; title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [loadedEpisodeId, setLoadedEpisodeId] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/watch/${encodeURIComponent(episodeId)}/playback`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { url?: string; error?: string };
        if (!response.ok || !data.url) throw new Error(data.error ?? "Video could not be loaded.");
        if (active) setUrl(data.url);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Video could not be loaded.");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setLoadedEpisodeId(episodeId);
        }
      });
    return () => { active = false; };
  }, [episodeId, refresh]);

  const currentEpisodeLoaded = loadedEpisodeId === episodeId;
  const visibleUrl = currentEpisodeLoaded ? url : "";
  const visibleError = currentEpisodeLoaded ? error : "";

  async function startPlayback() {
    const video = videoRef.current;
    if (!video) return;

    try {
      await video.play();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Playback could not start.");
    }
  }

  return (
    <div className="episode-video-player">
      {(!currentEpisodeLoaded || loading) && <p role="status">Preparing secure playback...</p>}
      {visibleError && <p role="alert">{visibleError}</p>}
      {visibleUrl && (
        <video
          ref={videoRef}
          key={visibleUrl}
          controls
          playsInline
          preload="metadata"
          aria-label={`Play ${title}`}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onError={() => {
            if (refresh === 0) {
              setLoading(true);
              setError("");
              setUrl("");
              setRefresh(1);
            }
            else setError("Playback failed. Please try again later.");
          }}
        >
          <source src={visibleUrl} type="video/mp4" />
          Your browser does not support HTML video playback.
        </video>
      )}
      {visibleUrl && !isPlaying && (
        <button
          className="episode-video-player__play"
          type="button"
          onClick={() => void startPlayback()}
          aria-label={visibleError ? `Retry playback of ${title}` : `Play ${title}`}
        >
          <span className="episode-video-player__play-icon" aria-hidden="true" />
          <span>{visibleError ? "Try again" : "Play episode"}</span>
        </button>
      )}
    </div>
  );
}
