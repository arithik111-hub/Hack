import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { Icon } from "@/components/animex/Icon";
import { PageNavigation } from "@/components/animex/PageNavigation";
import { getPublishedAnimeCatalog } from "@/lib/public-content";
import { genreCatalog } from "@/data/genres";

export const metadata: Metadata = {
  title: "Browse genres",
  description: "Explore anime by genre in the ANIMEX catalogue.",
};

export default function GenresPage() {
  return (
    <>
      <PageNavigation />
      <Suspense
        fallback={
          <main className="discovery-page page-gutter genre-page">
            <div className="catalog-empty" role="status">Loading genres...</div>
          </main>
        }
      >
        <GenresContent />
      </Suspense>
    </>
  );
}

async function GenresContent() {
  const animeCatalog = await getPublishedAnimeCatalog();
  const genresByName = new Map(genreCatalog.map((genre) => [genre.name.toLowerCase(), genre]));
  const names = [...new Set([
    ...genreCatalog.map((genre) => genre.name),
    ...animeCatalog.flatMap((anime) => anime.genres),
  ])];
  const availableGenres = names.map((name, index) => genresByName.get(name.toLowerCase()) ?? {
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    description: `Explore anime titles in the ${name} genre.`,
    accent: ["#b45d74", "#6085b3", "#9a6cb5", "#7366bc"][index % 4],
  });
  return (
    <main className="discovery-page page-gutter genre-page">
      <header className="discovery-page__intro">
        <p className="eyebrow section-eyebrow">PICK YOUR MOOD</p>
        <h1>
          Explore by <span>genre</span>
        </h1>
        <p>Find a new favorite by the kind of story you want to experience.</p>
      </header>
      <div className="genre-catalog-grid">
        {availableGenres.map((genre) => {
          const count = animeCatalog.filter((anime) =>
            anime.genres.includes(genre.name),
          ).length;

          return (
            <Link
              className="genre-catalog-card"
              href={`/genres/${genre.slug}`}
              key={genre.slug}
              style={{ "--genre-accent": genre.accent } as CSSProperties}
            >
              <span className="genre-catalog-card__count">
                {String(count).padStart(2, "0")} TITLES
              </span>
              <span className="genre-catalog-card__name">{genre.name}</span>
              <span className="genre-catalog-card__description">
                {genre.description}
              </span>
              <span className="genre-catalog-card__action">
                Browse genre <Icon name="arrow-right" size={16} />
              </span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
