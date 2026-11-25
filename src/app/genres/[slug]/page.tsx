import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AnimeCard } from "@/components/animex/AnimeCard";
import { Icon } from "@/components/animex/Icon";
import { PageNavigation } from "@/components/animex/PageNavigation";
import { getPublishedAnimeCatalog } from "@/lib/public-content";
import { genreCatalog, getGenreBySlug } from "@/data/genres";

type GenrePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return genreCatalog.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: GenrePageProps): Promise<Metadata> {
  const { slug } = await params;
  const genre = getGenreBySlug(slug);

  return genre
    ? {
        title: `${genre.name} anime`,
        description: genre.description,
      }
    : {};
}

export default function GenreDetailPage({ params }: GenrePageProps) {
  return (
    <>
      <PageNavigation />
      <Suspense
        fallback={
          <main className="discovery-page page-gutter">
            <div className="catalog-empty" role="status">
              Loading genre...
            </div>
          </main>
        }
      >
        <GenreDetailContent params={params} />
      </Suspense>
    </>
  );
}

async function GenreDetailContent({ params }: GenrePageProps) {
  const { slug } = await params;
  const catalog = await getPublishedAnimeCatalog();
  const genre = getGenreBySlug(slug) ?? (() => {
    const name = [...new Set(catalog.flatMap((anime) => anime.genres))]
      .find((entry) => entry.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") === slug);
    return name ? { name, slug, description: `Explore anime titles in the ${name} genre.`, accent: "#7366bc" } : undefined;
  })();

  if (!genre) notFound();

  const titles = catalog
    .filter((anime) => anime.genres.includes(genre.name))
    .sort((first, second) => second.popularity - first.popularity);

  return (
    <main className="discovery-page page-gutter genre-detail-page">
      <Link className="state-back-link" href="/genres">
        <Icon name="arrow-left" size={16} />
        All genres
      </Link>
      <header className="discovery-page__intro">
        <p className="eyebrow section-eyebrow">ANIMEX GENRE GUIDE</p>
        <h1>
          {genre.name} <span>anime</span>
        </h1>
        <p>{genre.description}</p>
      </header>
      <div className="genre-detail__heading">
        <h2>{titles.length} matching titles</h2>
      </div>
      {titles.length > 0 ? (
        <div className="anime-grid catalog-anime-grid">
          {titles.map((anime) => (
            <AnimeCard key={anime.id} anime={anime} />
          ))}
        </div>
      ) : (
        <div className="catalog-empty" role="status">
          No anime have been added to this genre yet.
        </div>
      )}
    </main>
  );
}
