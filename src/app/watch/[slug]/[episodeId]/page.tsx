import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AnimeArtwork } from "@/components/animex/AnimeArtwork";
import { Icon } from "@/components/animex/Icon";
import { PageNavigation } from "@/components/animex/PageNavigation";
import { SupabaseVideoPlayer } from "@/components/animex/SupabaseVideoPlayer";
import { animeEpisodes, getAnimeById } from "@/data/anime";
import { getPublishedEpisodeById } from "@/lib/public-content";

type EpisodePageProps = {
  params: Promise<{ slug: string; episodeId: string }>;
};

export function generateStaticParams() {
  return animeEpisodes.flatMap((episode) => {
    const anime = getAnimeById(episode.animeId);
    return anime ? [{ slug: anime.slug, episodeId: episode.id }] : [];
  });
}

export async function generateMetadata({
  params,
}: EpisodePageProps): Promise<Metadata> {
  const { episodeId } = await params;
  const episode = animeEpisodes.find((entry) => entry.id === episodeId);
  return episode ? { title: episode.title } : {};
}

export default function EpisodePage({ params }: EpisodePageProps) {
  return (
    <>
      <PageNavigation />
      <Suspense
        fallback={
          <main className="state-page">
            <div className="state-card" role="status">
              Loading episode details...
            </div>
          </main>
        }
      >
        <EpisodeContent params={params} />
      </Suspense>
    </>
  );
}

async function EpisodeContent({ params }: EpisodePageProps) {
  const { slug, episodeId } = await params;
  const result = await getPublishedEpisodeById(episodeId);
  const episode = result?.episode;
  const anime = result?.anime;

  if (!episode || !anime || anime.slug !== slug) notFound();

  return (
    <main className="state-page episode-detail-page">
      <article className="state-card episode-detail-card">
        <Link className="state-back-link" href={`/anime/${anime.slug}`}>
          <Icon name="arrow-left" size={16} />
          Back to {anime.title}
        </Link>
        <p className="eyebrow state-eyebrow">
          SEASON EPISODE {episode.episodeNumber}
        </p>
        <h1>{episode.title}</h1>
        <p className="state-card__description">
          {anime.title} · {episode.duration} min · Sample release date{" "}
          {episode.releaseDate}
        </p>
        {episode.playbackAvailable ? (
          <SupabaseVideoPlayer key={episode.id} episodeId={episode.id} title={episode.title} />
        ) : (
          <div className="episode-detail-art">
            <AnimeArtwork
              src={episode.thumbnail}
              alt={`${anime.title} episode artwork`}
              title={episode.title}
              accent={anime.accent}
              sizes="(max-width: 700px) 90vw, 900px"
            />
            <div className="episode-detail-art__shade" aria-hidden="true" />
            <div className="episode-detail-art__message" role="status">
              <span className="quick-stat__icon">
                <Icon name="tv" size={20} />
              </span>
              <h2>Playback coming soon</h2>
              <p>This episode has no published Supabase MP4 source configured.</p>
            </div>
          </div>
        )}
        <p className="episode-detail-card__description">{episode.description}</p>
        <div className="state-card__actions">
          <Link className="button button-outline" href={`/anime/${anime.slug}`}>
            View all seasons
          </Link>
          <Link className="button button-primary" href="/anime">
            Browse catalogue
            <Icon name="arrow-right" size={16} />
          </Link>
        </div>
      </article>
    </main>
  );
}
