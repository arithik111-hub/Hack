import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getDatabase } from "@/lib/db";

const episodeSchema = z.object({
  id: z.string().cuid().optional(),
  animeId: z.string().cuid(),
  seasonId: z.string().cuid(),
  episodeNumber: z.coerce.number().int().min(1).max(10000),
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().min(1).max(5000),
  thumbnail: z.url(),
  duration: z.coerce.number().int().min(1).max(86400),
  releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  published: z.boolean(),
});

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden." }, { status: 403 });
  try {
    const db = getDatabase();
    const [episodes, animes, seasons] = await Promise.all([
      db.episode.findMany({
        orderBy: [{ animeId: "asc" }, { seasonId: "asc" }, { episodeNumber: "asc" }],
        include: { anime: { select: { id: true, title: true } }, season: { select: { id: true, title: true, seasonNumber: true } } },
      }),
      db.anime.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }),
      db.season.findMany({ orderBy: [{ animeId: "asc" }, { seasonNumber: "asc" }], include: { anime: { select: { title: true } } } }),
    ]);
    return Response.json({ episodes, animes, seasons });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Database unavailable." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden." }, { status: 403 });
  const parsed = episodeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Please check episode fields.", fields: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
  try {
    const db = getDatabase();
    const season = await db.season.findUnique({ where: { id: parsed.data.seasonId }, select: { animeId: true } });
    if (!season || season.animeId !== parsed.data.animeId) return Response.json({ error: "Season does not belong to that anime." }, { status: 400 });
    await db.episode.create({ data: {
      animeId: parsed.data.animeId,
      seasonId: parsed.data.seasonId,
      episodeNumber: parsed.data.episodeNumber,
      title: parsed.data.title,
      description: parsed.data.description,
      thumbnail: parsed.data.thumbnail,
      duration: parsed.data.duration,
      releaseDate: new Date(`${parsed.data.releaseDate}T00:00:00.000Z`),
      published: parsed.data.published,
    } });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Episode could not be created. The episode number may already exist in this season." }, { status: 409 });
  }
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden." }, { status: 403 });
  const parsed = episodeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !parsed.data.id) return Response.json({ error: "Invalid episode." }, { status: 400 });
  try {
    const db = getDatabase();
    const season = await db.season.findUnique({ where: { id: parsed.data.seasonId }, select: { animeId: true } });
    if (!season || season.animeId !== parsed.data.animeId) return Response.json({ error: "Season does not belong to that anime." }, { status: 400 });
    await db.episode.update({
      where: { id: parsed.data.id },
      data: {
        animeId: parsed.data.animeId,
        seasonId: parsed.data.seasonId,
        episodeNumber: parsed.data.episodeNumber,
        title: parsed.data.title,
        description: parsed.data.description,
        thumbnail: parsed.data.thumbnail,
        duration: parsed.data.duration,
        releaseDate: new Date(`${parsed.data.releaseDate}T00:00:00.000Z`),
        published: parsed.data.published,
      },
    });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Episode could not be updated." }, { status: 409 });
  }
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden." }, { status: 403 });
  const parsed = z.object({ id: z.string().cuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid episode." }, { status: 400 });
  try {
    await getDatabase().episode.delete({ where: { id: parsed.data.id } });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Episode could not be deleted." }, { status: 500 });
  }
}
