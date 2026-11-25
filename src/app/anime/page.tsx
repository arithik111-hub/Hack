import type { Metadata } from "next";
import { Suspense } from "react";
import AnimeCatalogClient from "@/components/animex/AnimeCatalogClient";
import { PageNavigation } from "@/components/animex/PageNavigation";
import { getPublishedAnimeCatalog } from "@/lib/public-content";

export const metadata: Metadata = {
  title: "Anime Catalogue",
  description:
    "Browse the ANIMEX anime catalogue and filter by genre, year, rating, type, status, and language.",
};

export default function AnimeCataloguePage() {
  return (
    <>
      <PageNavigation />
      <Suspense
        fallback={
          <main className="discovery-page page-gutter catalog-page">
            <div className="catalog-empty" role="status">Loading anime catalogue...</div>
          </main>
        }
      >
        <AnimeCatalogueContent />
      </Suspense>
    </>
  );
}

async function AnimeCatalogueContent() {
  const catalog = await getPublishedAnimeCatalog();
  return (
    <main className="discovery-page page-gutter catalog-page">
      <header className="discovery-page__intro">
        <p className="eyebrow section-eyebrow">YOUR NEXT STORY STARTS HERE</p>
        <h1>
          Anime <span>catalogue</span>
        </h1>
        <p>
          Explore {catalog.length} hand-curated titles. Narrow the list
          by the details that matter to you.
        </p>
      </header>
      <AnimeCatalogClient catalog={catalog} />
    </main>
  );
}
