import type { Metadata } from "next";
import { Suspense } from "react";
import { PageNavigation } from "@/components/animex/PageNavigation";
import { SearchExperience } from "@/components/animex/SearchExperience";
import { getPublishedAnimeCatalog } from "@/lib/public-content";

type SearchPageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

export const metadata: Metadata = {
  title: "Search anime",
  description:
    "Search anime titles, alternate names, and genres in the ANIMEX catalogue.",
};

export default function SearchPage({ searchParams }: SearchPageProps) {
  return (
    <>
      <PageNavigation />
      <Suspense
        fallback={
          <main className="discovery-page page-gutter">
            <div className="catalog-empty" role="status">
              Loading search...
            </div>
          </main>
        }
      >
        <SearchPageContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function SearchPageContent({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const initialQuery = Array.isArray(params.q) ? params.q[0] ?? "" : params.q ?? "";
  const catalog = await getPublishedAnimeCatalog();

  return <SearchExperience initialQuery={initialQuery} catalog={catalog} />;
}
