"use client";

import { useState } from "react";
import { Icon } from "@/components/animex/Icon";

export function ShareButton() {
  const [message, setMessage] = useState("");

  const sharePage = async () => {
    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({ title: document.title, url });
        setMessage("Link shared.");
        return;
      }

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setMessage("Link copied.");
        return;
      }

      setMessage("Copy this page address from your browser to share it.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage("Sharing is unavailable. Copy this page address instead.");
    }
  };

  return (
    <div className="share-control">
      <button className="button button-outline" type="button" onClick={sharePage}>
        <Icon name="arrow-right" size={16} />
        Share
      </button>
      {message && (
        <span className="watchlist-message" role="status">
          {message}
        </span>
      )}
    </div>
  );
}
