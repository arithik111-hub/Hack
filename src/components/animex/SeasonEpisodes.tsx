"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimeArtwork } from "@/components/animex/AnimeArtwork";
import { Icon } from "@/components/animex/Icon";
import { type Anime, type Episode, type Season } from "@/data/anime";

type SeasonEpisodesProps = {
  anime: Anime;
  seasons: Season[];
  episodes?: Episode[];
};

function formatReleaseDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function EpisodeRow({ anime, episode }: { anime: Anime; episode: Episode }) {
  return (
    <article className="episode-row">
      <Link
        className="episode-row__thumbnail"
        href={`/watch/${anime.slug}/${episode.id}`}
        aria-label={`View episode ${episode.episodeNumber}: ${episode.title}`}
      >
        <AnimeArtwork
          src={episode.thumbnail}
          alt=""
          title={episode.title}
          accent={anime.accent}
          sizes="(max-width: 620px) 30vw, 190px"
        />
        <span className="episode-row__thumbnail-play" aria-hidden="true">
          <Icon name="play" size={16} />
        </span>
      </Link>
      <div className="episode-row__content">
        <div className="episode-row__eyebrow">
          EPISODE {String(episode.episodeNumber).padStart(2, "0")}
          <span className="meta-dot" />
          {episode.duration} MIN
        </div>
        <Link
          className="episode-row__title"
          href={`/watch/${anime.slug}/${episode.id}`}
        >
          {episode.title}
        </Link>
        <p className="episode-row__description">{episode.description}</p>
        <div className="episode-row__release">
          Sample release date · {formatReleaseDate(episode.releaseDate)}
        </div>
      </div>
      <div className="episode-row__actions">
        {episode.playbackAvailable ? (
          <Link
            className="episode-play-button"
            href={`/watch/${anime.slug}/${episode.id}`}
            aria-label={`Play ${episode.title}`}
          >
            <Icon name="play" size={15} />
            Play
          </Link>
        ) : (
          <span className="episode-unavailable">Coming soon</span>
        )}
        <Link
          className="episode-details-link"
          href={`/watch/${anime.slug}/${episode.id}`}
        >
          Episode details
        </Link>
      </div>
    </article>
  );
}

export function SeasonEpisodes({ anime, seasons, episodes: suppliedEpisodes = [] }: SeasonEpisodesProps) {
  const [selectedSeasonId, setSelectedSeasonId] = useState(seasons[0]?.id ?? "");
  const episodes = useMemo(
    () =>
      suppliedEpisodes.length
        ? suppliedEpisodes.filter(
            (episode) =>
              episode.animeId === anime.id && episode.seasonId === selectedSeasonId,
          )
        : [],
    [anime.id, selectedSeasonId, suppliedEpisodes],
  );
  const selectedSeason = seasons.find((season) => season.id === selectedSeasonId);

  return (
    <section className="detail-episodes" aria-labelledby="episodes-heading">
      <div className="detail-section-heading">
        <div>
          <p className="eyebrow section-eyebrow">SEASON GUIDE</p>
          <h2 id="episodes-heading">
            Episodes <span>&amp; seasons</span>
          </h2>
        </div>
        {seasons.length > 0 && (
          <label className="season-select-wrap">
            <span>Choose a season</span>
            <select
              aria-label="Choose a season"
              value={selectedSeasonId}
              onChange={(event) => setSelectedSeasonId(event.target.value)}
            >
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.title} · {season.episodeCount} episodes
                </option>
              ))}
            </select>
            <Icon name="chevron-down" size={16} />
          </label>
        )}
      </div>

      {selectedSeason ? (
        <>
          <p className="episode-sample-note">
            Episodes without a verified playable source are marked as coming soon.
          </p>
          <div className="episode-list">
            {episodes.map((episode) => (
              <EpisodeRow key={episode.id} anime={anime} episode={episode} />
            ))}
          </div>
          {episodes.length === 0 && (
            <div className="catalog-empty" role="status">
              No episode records have been added to this season yet.
            </div>
          )}
        </>
      ) : (
        <div className="catalog-empty" role="status">
          {anime.type === "Movie"
            ? "Feature films do not have a season or episode list."
            : "No seasons have been added for this title yet."}
        </div>
      )}
    </section>
  );
}
