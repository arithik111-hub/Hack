import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { AnimeArtwork } from "@/components/animex/AnimeArtwork";
import { Icon } from "@/components/animex/Icon";
import {
  getPublishedAnimeBySlug,
  getPublishedAnimeEpisodes,
  getPublishedAnimeSeasons,
} from "@/lib/public-content";

type WatchPageProps = {
  params: Promise<{ slug: string }>;
};

export default function WatchPage({ params }: WatchPageProps) {
  return (
    <Suspense fallback={<main className="state-page"><div className="state-card" role="status">Loading anime...</div></main>}>
      <WatchPageContent params={params} />
    </Suspense>
  );
}

async function WatchPageContent({ params }: WatchPageProps) {
  const { slug } = await params;
  const anime = await getPublishedAnimeBySlug(slug);

  if (!anime) notFound();

  const seasons = await getPublishedAnimeSeasons(anime.id);
  const episodesBySeason = await Promise.all(
    seasons.map((season) => getPublishedAnimeEpisodes(anime.id, season.id)),
  );
  const firstPlayableEpisode = episodesBySeason
    .flat()
    .find((episode) => episode.playbackAvailable);

  if (firstPlayableEpisode) {
    redirect(`/watch/${anime.slug}/${firstPlayableEpisode.id}`);
  }

  return (
    <main className="state-page">
      <section className="state-card">
        <Link className="state-back-link" href={`/anime/${anime.slug}`}>
          <Icon name="arrow-left" size={16} />
          Back to {anime.title}
        </Link>
        <p className="eyebrow state-eyebrow">PLAYBACK STATUS</p>
        <h1>{anime.title}</h1>
        <div className="playback-placeholder">
          <AnimeArtwork
            src={anime.banner}
            alt=""
            title={anime.title}
            accent={anime.accent}
            sizes="(max-width: 700px) 90vw, 700px"
          />
          <div className="playback-placeholder__content">
            <span className="quick-stat__icon">
              <Icon name="tv" size={20} />
            </span>
            <h2>No playable episodes are published yet</h2>
            <p>
              This title has no published episode with an active, verified video source.
            </p>
          </div>
        </div>
        <div className="state-card__actions">
          <Link className="button button-outline" href={`/anime/${anime.slug}`}>
            View title details
          </Link>
          <Link className="button button-primary" href="/#trending">
            Discover more anime
            <Icon name="arrow-right" size={16} />
          </Link>
        </div>
      </section>
    </main>
  );
}
