import bcrypt from "bcryptjs";
import { z } from "zod";
import { getDatabase } from "@/lib/db";

const registrationSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z.email().trim().toLowerCase().max(254),
    password: z
      .string()
      .min(10)
      .max(128)
      .regex(/[A-Z]/)
      .regex(/[a-z]/)
      .regex(/[0-9]/),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

const attempts = new Map<string, { count: number; resetAt: number }>();

function allowed(ip: string) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt <= now) {
    attempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count += 1;
  return true;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  if (!allowed(ip)) {
    return Response.json(
      { error: "Too many registration attempts. Try again later." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Please check the registration fields.",
        fields: z.flattenError(parsed.error).fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    const db = getDatabase();
    const existing = await db.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    });
    if (existing) {
      return Response.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }

    await db.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash: await bcrypt.hash(parsed.data.password, 12),
        role: "USER",
      },
    });
    return Response.json(
      { success: true, message: "Your ANIMEX account was created." },
      { status: 201 },
    );
  } catch (error) {
    console.error("Registration failed", error);
    return Response.json(
      { error: "Registration is temporarily unavailable." },
      { status: 503 },
    );
  }
}
