import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { PageNavigation } from "@/components/animex/PageNavigation";
import Link from "next/link";

export const metadata: Metadata = { title: "My watchlist" };

export default function WatchlistPage() {
  return <><PageNavigation /><Suspense fallback={<main className="state-page"><div className="state-card">Loading watchlist...</div></main>}><WatchlistContent /></Suspense></>;
}

async function WatchlistContent() {
  const user = await requireUser();
  if (!user) redirect("/login");
  const entries = await getDatabase().watchlist.findMany({
    where: { userId: user.id },
    include: { anime: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <main className="discovery-page page-gutter">
      <header className="discovery-page__intro"><p className="eyebrow section-eyebrow">YOUR SAVED TITLES</p><h1>Watchlist</h1></header>
      {entries.length ? <div className="personal-grid">{entries.map((entry) => <Link className="personal-card" href={`/anime/${entry.anime.slug}`} key={entry.id}><h2>{entry.anime.title}</h2><p>{entry.anime.releaseYear} · {entry.anime.status}</p></Link>)}</div> : <div className="catalog-empty"><h3>Your watchlist is empty</h3><p>Open an anime and add it to your personal watchlist.</p><Link className="button button-primary" href="/anime">Browse anime</Link></div>}
    </main>
  );
}
