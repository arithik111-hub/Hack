import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { PageNavigation } from "@/components/animex/PageNavigation";

export const metadata: Metadata = { title: "Watch history" };

export default function HistoryPage() {
  return <><PageNavigation /><Suspense fallback={<main className="state-page"><div className="state-card">Loading history...</div></main>}><HistoryContent /></Suspense></>;
}
async function HistoryContent() {
  const user = await requireUser();
  if (!user) redirect("/login");
  const entries = await getDatabase().watchHistory.findMany({ where: { userId: user.id }, include: { episode: { include: { anime: true } } }, orderBy: { updatedAt: "desc" }, take: 100 });
  return <main className="discovery-page page-gutter"><header className="discovery-page__intro"><p className="eyebrow section-eyebrow">CONTINUE WATCHING</p><h1>Watch history</h1></header>{entries.length ? <div className="personal-grid">{entries.map((entry) => <Link className="personal-card" href={`/watch/${entry.episode.anime.slug}/${entry.episodeId}`} key={entry.id}><h2>{entry.episode.anime.title}</h2><p>Episode {entry.episode.episodeNumber} · {entry.progressSeconds}s · {entry.completed ? "Completed" : "In progress"}</p></Link>)}</div> : <div className="catalog-empty"><h3>No viewing history</h3><p>Authorized playback will record progress here.</p><Link className="button button-primary" href="/anime">Browse anime</Link></div>}</main>;
}
