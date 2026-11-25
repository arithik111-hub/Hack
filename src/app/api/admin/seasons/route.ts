import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getDatabase } from "@/lib/db";

const seasonSchema = z.object({
  id: z.string().cuid().optional(),
  animeId: z.string().cuid(),
  seasonNumber: z.coerce.number().int().min(1).max(999),
  title: z.string().trim().min(1).max(160),
  episodeCount: z.coerce.number().int().min(0).max(10000),
  releaseYear: z.coerce.number().int().min(1900).max(2100).nullable().optional(),
});

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden." }, { status: 403 });
  try {
    const db = getDatabase();
    const [seasons, animes] = await Promise.all([
      db.season.findMany({
        orderBy: [{ animeId: "asc" }, { seasonNumber: "asc" }],
        include: { anime: { select: { id: true, title: true } }, _count: { select: { episodes: true } } },
      }),
      db.anime.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }),
    ]);
    return Response.json({ seasons, animes });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Database unavailable." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden." }, { status: 403 });
  const parsed = seasonSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Please check season fields.", fields: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
  try {
    const db = getDatabase();
    await db.season.create({ data: {
      animeId: parsed.data.animeId,
      seasonNumber: parsed.data.seasonNumber,
      title: parsed.data.title,
      episodeCount: parsed.data.episodeCount,
      releaseYear: parsed.data.releaseYear ?? null,
    } });
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: "Season could not be created. The season number may already exist.", details: error instanceof Error ? error.message : undefined }, { status: 409 });
  }
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden." }, { status: 403 });
  const parsed = seasonSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !parsed.data.id) return Response.json({ error: "Invalid season." }, { status: 400 });
  try {
    const db = getDatabase();
    await db.season.update({
      where: { id: parsed.data.id },
      data: {
        animeId: parsed.data.animeId,
        seasonNumber: parsed.data.seasonNumber,
        title: parsed.data.title,
        episodeCount: parsed.data.episodeCount,
        releaseYear: parsed.data.releaseYear ?? null,
      },
    });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Season could not be updated." }, { status: 409 });
  }
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden." }, { status: 403 });
  const parsed = z.object({ id: z.string().cuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid season." }, { status: 400 });
  try {
    const db = getDatabase();
    const count = await db.episode.count({ where: { seasonId: parsed.data.id } });
    if (count > 0) return Response.json({ error: `Cannot delete: this season contains ${count} episode records. Delete or move the episodes first.` }, { status: 409 });
    await db.season.delete({ where: { id: parsed.data.id } });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Season could not be deleted." }, { status: 500 });
  }
}
