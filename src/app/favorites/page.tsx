import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { PageNavigation } from "@/components/animex/PageNavigation";

export const metadata: Metadata = { title: "My favorites" };

export default function FavoritesPage() {
  return <><PageNavigation /><Suspense fallback={<main className="state-page"><div className="state-card">Loading favorites...</div></main>}><FavoritesContent /></Suspense></>;
}
async function FavoritesContent() {
  const user = await requireUser();
  if (!user) redirect("/login");
  const entries = await getDatabase().favorite.findMany({ where: { userId: user.id }, include: { anime: true }, orderBy: { createdAt: "desc" } });
  return <main className="discovery-page page-gutter"><header className="discovery-page__intro"><p className="eyebrow section-eyebrow">YOUR FAVORITES</p><h1>Favorites</h1></header>{entries.length ? <div className="personal-grid">{entries.map((entry) => <Link className="personal-card" href={`/anime/${entry.anime.slug}`} key={entry.id}><h2>{entry.anime.title}</h2><p>{entry.anime.rating.toFixed(1)} rating</p></Link>)}</div> : <div className="catalog-empty"><h3>No favorites yet</h3><p>Add anime you love to find them here.</p><Link className="button button-primary" href="/anime">Browse anime</Link></div>}</main>;
}
