import Link from "next/link";
import { AnimeArtwork } from "@/components/animex/AnimeArtwork";
import { Icon } from "@/components/animex/Icon";
import type { Anime } from "@/data/anime";

type AnimeCardProps = {
  anime: Anime;
  rank?: number;
};

export function AnimeCard({ anime, rank }: AnimeCardProps) {
  return (
    <article className="anime-card">
      <Link
        href={`/anime/${anime.slug}`}
        className="anime-card__link"
        aria-label={`View details for ${anime.title}`}
      >
        <div className="anime-card__poster-wrap">
          <AnimeArtwork
            src={anime.poster}
            alt={`${anime.title} poster artwork`}
            title={anime.title}
            accent={anime.accent}
            sizes="(max-width: 620px) 44vw, (max-width: 1000px) 28vw, 18vw"
            className="anime-card__poster"
          />
          {rank !== undefined && (
            <span className="anime-card__rank">
              {String(rank).padStart(2, "0")}
            </span>
          )}
          <span className="anime-card__score">
            <Icon name="star" size={13} />
            {anime.rating.toFixed(1)}
          </span>
          <span className="anime-card__play" aria-hidden="true">
            <Icon name="play" size={19} />
          </span>
          <span className="anime-card__format">{anime.type}</span>
        </div>
        <div className="anime-card__info">
          <h3>{anime.title}</h3>
          <div className="anime-card__meta">
            {anime.source && (
              <span className="anime-card__source">
                {anime.source === "JIKAN" ? "Jikan" : anime.source === "KITSU" ? "Kitsu" : "AniList"}
              </span>
            )}
            <span>{anime.releaseYear}</span>
            <span className="meta-dot" aria-hidden="true" />
            <span>{anime.genres[0]}</span>
            <span className="meta-dot" aria-hidden="true" />
            <span>{anime.status}</span>
          </div>
          {anime.totalEpisodes !== null && (
            <span className="anime-card__episode-count">
              {anime.totalEpisodes.toLocaleString()} episodes
            </span>
          )}
        </div>
      </Link>
    </article>
  );
}
