import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDatabase } from "@/lib/db";

const schema = z.object({ animeId: z.string().cuid() });

export async function GET() {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const db = getDatabase();
  const entries = await db.watchlist.findMany({
    where: { userId: user.id },
    include: { anime: { select: { id: true, slug: true, title: true, poster: true, releaseYear: true } } },
    orderBy: { createdAt: "desc" },
  });
  return Response.json({ entries });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid anime." }, { status: 400 });
  const db = getDatabase();
  await db.watchlist.upsert({
    where: { userId_animeId: { userId: user.id, animeId: parsed.data.animeId } },
    update: {},
    create: { userId: user.id, animeId: parsed.data.animeId },
  });
  return Response.json({ success: true });
}

export async function DELETE(request: Request) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid anime." }, { status: 400 });
  const db = getDatabase();
  await db.watchlist.deleteMany({ where: { userId: user.id, animeId: parsed.data.animeId } });
  return Response.json({ success: true });
}
