import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getDatabase } from "@/lib/db";

const genreSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
});

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden." }, { status: 403 });
  const db = getDatabase();
  const genres = await db.genre.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { animes: true } } },
  });
  return Response.json({ genres });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden." }, { status: 403 });
  const parsed = genreSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Please check the genre fields." }, { status: 400 });
  const db = getDatabase();
  const duplicate = await db.genre.findFirst({ where: { OR: [{ name: parsed.data.name }, { slug: parsed.data.slug }] } });
  if (duplicate) return Response.json({ error: "A genre with that name or slug already exists." }, { status: 409 });
  const genre = await db.genre.create({ data: { name: parsed.data.name, slug: parsed.data.slug } });
  return Response.json({ success: true, genre });
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden." }, { status: 403 });
  const parsed = genreSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !parsed.data.id) return Response.json({ error: "Invalid genre." }, { status: 400 });
  const db = getDatabase();
  const duplicate = await db.genre.findFirst({
    where: { OR: [{ name: parsed.data.name }, { slug: parsed.data.slug }], NOT: { id: parsed.data.id } },
  });
  if (duplicate) return Response.json({ error: "A genre with that name or slug already exists." }, { status: 409 });
  await db.genre.update({ where: { id: parsed.data.id }, data: { name: parsed.data.name, slug: parsed.data.slug } });
  return Response.json({ success: true });
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden." }, { status: 403 });
  const parsed = z.object({ id: z.string().min(1) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Genre ID is required." }, { status: 400 });
  const db = getDatabase();
  await db.genre.delete({ where: { id: parsed.data.id } });
  return Response.json({ success: true });
}
