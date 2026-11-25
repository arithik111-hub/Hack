"use client";

import { useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/animex/Icon";

const STORAGE_KEY = "animex:watchlist:v1";
const CHANGE_EVENT = "animex:watchlist-change";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);

  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function readWatchlist() {
  const value = window.localStorage.getItem(STORAGE_KEY);
  if (!value) return [];

  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) {
    throw new Error("Saved watchlist data has an unexpected format.");
  }

  return parsed;
}

function isSaved(animeId: string) {
  try {
    return readWatchlist().includes(animeId);
  } catch {
    return false;
  }
}

function getStorageError() {
  try {
    readWatchlist();
    return "";
  } catch {
    return "Watchlist storage is unavailable or contains invalid data.";
  }
}

export function WatchlistButton({ animeId }: { animeId: string }) {
  const saved = useSyncExternalStore(
    subscribe,
    () => isSaved(animeId),
    () => false,
  );
  const storageError = useSyncExternalStore(subscribe, getStorageError, () => "");
  const [message, setMessage] = useState("");

  const toggleWatchlist = () => {
    try {
      const current = readWatchlist();
      const wasSaved = current.includes(animeId);
      const next = wasSaved
        ? current.filter((entry) => entry !== animeId)
        : [...new Set([...current, animeId])];

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(CHANGE_EVENT));
      setMessage(wasSaved ? "Removed from your watchlist." : "Added to your watchlist.");
    } catch {
      setMessage("Could not update your watchlist. Check this browser's storage settings.");
    }
  };

  return (
    <div className="watchlist-control">
      <button
        className={`button button-outline watchlist-button ${saved ? "is-saved" : ""}`}
        type="button"
        aria-pressed={saved}
        onClick={toggleWatchlist}
      >
        <Icon name={saved ? "check" : "heart"} size={17} />
        {saved ? "In watchlist" : "Add to Watchlist"}
      </button>
      {(message || storageError) && (
        <span className="watchlist-message" role="status">
          {message || storageError}
        </span>
      )}
    </div>
  );
}
