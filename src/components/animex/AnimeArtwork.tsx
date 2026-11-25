"use client";

import Image from "next/image";
import { useState } from "react";

type AnimeArtworkProps = {
  src: string;
  alt: string;
  title: string;
  accent: string;
  sizes: string;
  objectPosition?: string;
  priority?: boolean;
  className?: string;
};

export function AnimeArtwork({
  src,
  alt,
  title,
  accent,
  sizes,
  objectPosition,
  priority = false,
  className = "",
}: AnimeArtworkProps) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div
      className={`anime-artwork ${className}`}
      style={{ backgroundColor: accent }}
      role="img"
      aria-label={alt}
    >
      {!imageFailed && (
        <Image
          src={src}
          alt=""
          fill
          sizes={sizes}
          style={objectPosition ? { objectPosition } : undefined}
          quality={75}
          priority={priority}
          className="anime-artwork__image"
          onError={() => setImageFailed(true)}
        />
      )}
      <div className="anime-artwork__fallback" aria-hidden="true">
        <span>{title.slice(0, 1)}</span>
      </div>
      <div className="anime-artwork__shade" aria-hidden="true" />
    </div>
  );
}
