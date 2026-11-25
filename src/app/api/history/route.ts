import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDatabase } from "@/lib/db";

const schema = z.object({
  episodeId: z.string().cuid(),
  progressSeconds: z.number().int().min(0).max(86400),
  completed: z.boolean().optional(),
});

export async function GET() {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const db = getDatabase();
  const entries = await db.watchHistory.findMany({
    where: { userId: user.id },
    include: {
      episode: {
        include: { anime: { select: { id: true, slug: true, title: true, poster: true } } },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return Response.json({ entries });
}

export async function PUT(request: Request) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid progress update.", fields: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
  const db = getDatabase();
  await db.watchHistory.upsert({
    where: { userId_episodeId: { userId: user.id, episodeId: parsed.data.episodeId } },
    update: {
      progressSeconds: parsed.data.progressSeconds,
      completed: parsed.data.completed ?? false,
    },
    create: {
      userId: user.id,
      episodeId: parsed.data.episodeId,
      progressSeconds: parsed.data.progressSeconds,
      completed: parsed.data.completed ?? false,
    },
  });
  return Response.json({ success: true });
}

export async function DELETE(request: Request) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const parsed = z.object({ episodeId: z.string().cuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid episode." }, { status: 400 });
  await getDatabase().watchHistory.deleteMany({
    where: { userId: user.id, episodeId: parsed.data.episodeId },
  });
  return Response.json({ success: true });
}
