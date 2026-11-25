import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AnimeArtwork } from "@/components/animex/AnimeArtwork";
import { Icon } from "@/components/animex/Icon";
import { PageNavigation } from "@/components/animex/PageNavigation";
import { SeasonEpisodes } from "@/components/animex/SeasonEpisodes";
import { ShareButton } from "@/components/animex/ShareButton";
import { WatchlistButton } from "@/components/animex/WatchlistButton";
import { animeCatalog } from "@/data/anime";
import { getPublishedAnimeBySlug, getPublishedAnimeEpisodes, getPublishedAnimeSeasons } from "@/lib/public-content";

type AnimePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return animeCatalog.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: AnimePageProps): Promise<Metadata> {
  const { slug } = await params;
  const anime = await getPublishedAnimeBySlug(slug);

  return anime
    ? {
        title: anime.title,
        description: anime.description,
      }
    : {};
}

export default function AnimeDetailPage({ params }: AnimePageProps) {
  return (
    <>
      <PageNavigation />
      <Suspense
        fallback={
          <main className="discovery-page page-gutter">
            <div className="catalog-empty" role="status">
              Loading anime details...
            </div>
          </main>
        }
      >
        <AnimeDetailContent params={params} />
      </Suspense>
    </>
  );
}

async function AnimeDetailContent({ params }: AnimePageProps) {
  const { slug } = await params;
  const anime = await getPublishedAnimeBySlug(slug);

  if (!anime) notFound();

  const seasons = await getPublishedAnimeSeasons(anime.id);
  const episodes = (
    await Promise.all(
      seasons.map((season) => getPublishedAnimeEpisodes(anime.id, season.id)),
    )
  ).flat();
  const firstPlayableEpisode = episodes.find((episode) => episode.playbackAvailable);

  return (
    <main className="anime-detail-page">
      <section className="anime-cover page-gutter">
        <Link className="state-back-link" href="/anime">
          <Icon name="arrow-left" size={16} />
          Back to catalogue
        </Link>
        <p className="eyebrow state-eyebrow">ANIMEX TITLE GUIDE</p>
        <h1>{anime.title}</h1>
        {anime.alternativeTitles.length > 0 && (
          <p className="anime-cover__alternatives">
            Also known as {anime.alternativeTitles.join(" · ")}
          </p>
        )}
        <div className="hero-meta anime-cover__meta">
          <span className="rating-pill">
            <Icon name="star" size={14} />
            {anime.rating.toFixed(1)}
          </span>
          <span>{anime.releaseYear}</span>
          <span className="meta-dot" aria-hidden="true" />
          <span>{anime.type}</span>
          <span className="meta-dot" aria-hidden="true" />
          <span>{anime.status}</span>
        </div>
        <div className="anime-cover__frame">
          <AnimeArtwork
            src={anime.banner}
            alt={`${anime.title} banner artwork`}
            title={anime.title}
            accent={anime.accent}
            sizes="100vw"
            priority
            className="anime-cover__artwork"
          />
          <div className="anime-cover__shade" aria-hidden="true" />
          <div className="anime-cover__artwork-content">
            <span className="quick-stat__icon">
              <Icon name="tv" size={20} />
            </span>
            <p className="eyebrow state-eyebrow">COVER ARTWORK</p>
            <h2>{anime.genres.join(" · ") || anime.type}</h2>
            <p>{anime.description}</p>
            <div className="hero-tags" aria-label="Genres">
              {anime.genres.map((genre) => (
                <Link
                  className="hero-tag"
                  href={`/genres/${genre.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                  key={genre}
                >
                  {genre}
                </Link>
              ))}
            </div>
          </div>
        </div>
        <div className="hero-actions anime-cover__actions">
          <Link
            className="button button-primary"
            href={
              firstPlayableEpisode
                ? `/watch/${anime.slug}/${firstPlayableEpisode.id}`
                : "#episodes"
            }
          >
            <Icon name={firstPlayableEpisode ? "play" : "arrow-right"} size={18} />
            {firstPlayableEpisode ? "Watch now" : "View episodes"}
          </Link>
          <Link className="button button-outline" href="#about">
            View title details
          </Link>
          <WatchlistButton animeId={anime.id} />
          <ShareButton />
        </div>
      </section>

      <section className="page-gutter anime-detail-overview" id="about">
        <div className="anime-detail-poster">
          <AnimeArtwork
            src={anime.poster}
            alt={`${anime.title} cover artwork`}
            title={anime.title}
            accent={anime.accent}
            sizes="(max-width: 720px) 42vw, 260px"
          />
        </div>
        <div className="anime-detail-overview__content">
          <div className="detail-section-heading">
            <div>
              <p className="eyebrow section-eyebrow">AT A GLANCE</p>
              <h2>
                About <span>the anime</span>
              </h2>
            </div>
          </div>
          <p className="anime-detail-overview__description">{anime.description}</p>
          <dl className="anime-facts">
            <div>
              <dt>Studio</dt>
              <dd>{anime.studio}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{anime.status}</dd>
            </div>
            <div>
              <dt>Release year</dt>
              <dd>{anime.releaseYear}</dd>
            </div>
            {anime.season && (
              <div>
                <dt>Release season</dt>
                <dd>{anime.season}</dd>
              </div>
            )}
            <div>
              <dt>Type</dt>
              <dd>{anime.type}</dd>
            </div>
            {anime.durationMinutes && (
              <div>
                <dt>Episode duration</dt>
                <dd>{anime.durationMinutes} minutes</dd>
              </div>
            )}
            {anime.sourceMaterial && (
              <div>
                <dt>Source material</dt>
                <dd>{anime.sourceMaterial}</dd>
              </div>
            )}
            <div>
              <dt>Total seasons</dt>
              <dd>{seasons.length || "Not applicable"}</dd>
            </div>
            <div>
              <dt>Total episodes</dt>
              <dd>
                {anime.totalEpisodes === null
                  ? "Feature film"
                  : anime.totalEpisodes.toLocaleString()}
              </dd>
            </div>
            <div className="anime-facts__languages">
              <dt>Available languages</dt>
              <dd>{anime.languages.join(" · ")}</dd>
            </div>
            <div className="anime-facts__alternatives">
              <dt>Alternative titles</dt>
              <dd>{[anime.romajiTitle, anime.japaneseTitle, ...anime.alternativeTitles].filter(Boolean).join(" · ") || "—"}</dd>
            </div>
            {anime.officialWebsite && (
              <div>
                <dt>Official website</dt>
                <dd><a href={anime.officialWebsite} target="_blank" rel="noreferrer">Visit official site</a></dd>
              </div>
            )}
          </dl>
        </div>
      </section>

      <div className="page-gutter anime-detail-episodes" id="episodes">
        <SeasonEpisodes key={anime.id} anime={anime} seasons={seasons} episodes={episodes} />
        {anime.source && (
          <p className="anilist-attribution">
            Anime metadata and cover artwork sourced from{" "}
            <a
              href={
                anime.source === "JIKAN"
                  ? "https://jikan.moe/"
                  : anime.source === "KITSU"
                    ? "https://kitsu.io/"
                    : "https://anilist.co"
              }
              target="_blank"
              rel="noreferrer"
            >
              {anime.source === "JIKAN" ? "Jikan" : anime.source === "KITSU" ? "Kitsu" : "AniList"}
            </a>.
          </p>
        )}
      </div>
    </main>
  );
}
