import type { Metadata } from "next";
import { Suspense } from "react";
import { AnimeCard } from "@/components/animex/AnimeCard";
import { PageNavigation } from "@/components/animex/PageNavigation";
import { getPublishedAnimeCatalog } from "@/lib/public-content";

export const metadata: Metadata = {
  title: "Design templates",
  description: "Explore original visual directions for the ANIMEX anime catalogue.",
};

export default function TemplatesPage() {
  return (
    <>
      <PageNavigation />
      <Suspense fallback={<main className="discovery-page page-gutter"><div className="catalog-empty" role="status">Loading templates...</div></main>}>
        <TemplateContent />
      </Suspense>
    </>
  );
}

async function TemplateContent() {
  const catalog = await getPublishedAnimeCatalog();
  const previews = [...catalog].sort((first, second) => second.popularity - first.popularity).slice(0, 4);

  return (
    <main className="discovery-page page-gutter template-page">
      <header className="discovery-page__intro">
        <p className="eyebrow section-eyebrow">ANIMEX DESIGN LIBRARY</p>
        <h1>Visual <span>templates</span></h1>
        <p>Design references for browsing anime with a cinematic, neon-accented interface.</p>
      </header>
      <article className="template-reference">
        <div className="template-reference__copy">
          <p className="eyebrow section-eyebrow">REFERENCE 01 · DISCOVERY</p>
          <h2>Neon anime discovery</h2>
          <p>
            A dark, high-contrast catalogue direction with a featured hero, compact
            navigation, genre filters, horizontal discovery rails, and vivid violet accents.
            It is a layout reference, not a reproduction of third-party character artwork.
          </p>
          <ul>
            <li>Featured title and clear primary action</li>
            <li>Responsive catalogue cards and genre browsing</li>
            <li>Original or appropriately attributed cover artwork</li>
          </ul>
        </div>
        <div className="template-reference__preview" aria-label="Template preview using current ANIMEX catalogue">
          {previews.map((anime, index) => <AnimeCard key={anime.id} anime={anime} rank={index + 1} />)}
        </div>
      </article>
      {previews.some((anime) => anime.source) && (
        <p className="template-page__attribution">
          Imported titles are credited on their detail pages.{" "}
          <a href="https://jikan.moe/" target="_blank" rel="noreferrer">Visit Jikan</a> or{" "}
          <a href="https://anilist.co" target="_blank" rel="noreferrer">AniList</a> or{" "}
          <a href="https://kitsu.io/" target="_blank" rel="noreferrer">Kitsu</a>.
        </p>
      )}
    </main>
  );
}
