import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDatabase } from "@/lib/db";

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  image: z
    .union([z.url(), z.literal("")])
    .optional()
    .transform((value) => value || null),
});

export async function PATCH(request: Request) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Please check your profile details.", fields: z.flattenError(parsed.error).fieldErrors },
      { status: 400 },
    );
  }

  try {
    const db = getDatabase();
    const updated = await db.user.update({
      where: { id: user.id },
      data: { name: parsed.data.name, image: parsed.data.image },
      select: { id: true, name: true, email: true, image: true, role: true, createdAt: true },
    });
    return Response.json({ success: true, user: updated });
  } catch (error) {
    console.error("Profile update failed", error);
    return Response.json({ error: "Profile update failed." }, { status: 500 });
  }
}
