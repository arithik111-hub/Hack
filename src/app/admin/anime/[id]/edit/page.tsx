import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getDatabase } from "@/lib/db";
import { EditAnimeForm } from "@/components/admin/EditAnimeForm";

export const metadata: Metadata = { title: "Edit anime" };

export default function EditAnimePage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<div className="admin-panel">Loading anime...</div>}><EditAnimeContent params={params} /></Suspense>;
}

async function EditAnimeContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDatabase();
  const [anime, genres] = await Promise.all([
    db.anime.findUnique({ where: { id }, include: { genres: { select: { genreId: true } } } }),
    db.genre.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!anime) notFound();
  return (
    <EditAnimeForm
      anime={{
        ...anime,
        lastSyncedAt: anime.lastSyncedAt?.toISOString() ?? null,
        genreIds: anime.genres.map((entry) => entry.genreId),
      }}
      genres={genres}
    />
  );
}
