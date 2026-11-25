import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getDatabase } from "@/lib/db";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden." }, { status: 403 });
  try {
    const users = await getDatabase().user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
        image: true,
        _count: { select: { watchlist: true, favorites: true, watchHistory: true } },
      },
    });
    return Response.json({ users });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Database unavailable." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden." }, { status: 403 });
  const parsed = z.object({
    id: z.string().cuid(),
    active: z.boolean(),
  }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid account status." }, { status: 400 });
  if (parsed.data.id === admin.id) {
    return Response.json({ error: "You cannot disable your own administrator account." }, { status: 409 });
  }
  try {
    await getDatabase().user.update({
      where: { id: parsed.data.id },
      data: { active: parsed.data.active },
    });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Account status could not be updated." }, { status: 500 });
  }
}
