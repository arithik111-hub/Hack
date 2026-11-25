import "server-only";
import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { getServerSession } from "next-auth/next";
import { randomBytes } from "crypto";
import { connection } from "next/server";
import { getDatabase } from "@/lib/db";

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "Email and password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials.password) return null;
      const db = getDatabase();
      const user = await db.user.findUnique({
        where: { email: credentials.email.toLowerCase().trim() },
      });
      if (!user || !user.active) return null;
      if (!(await bcrypt.compare(credentials.password, user.passwordHash))) {
        return null;
      }
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
      };
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  secret: process.env.AUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  providers,
  callbacks: {
    async signIn({ account, profile, user }) {
      if (account?.provider !== "google") return true;
      const email = profile?.email?.toLowerCase().trim();
      if (!email) return false;

      try {
        const db = getDatabase();
        const existing = await db.user.findUnique({ where: { email } });
        if (existing) {
          if (!existing.active) return false;
          await db.user.update({
            where: { id: existing.id },
            data: {
              name: existing.name === "Google User" ? user.name ?? existing.name : existing.name,
              image: user.image ?? existing.image,
            },
          });
          user.id = existing.id;
          (user as { role?: "USER" | "ADMIN" }).role = existing.role;
        } else {
          const created = await db.user.create({
            data: {
              name: user.name?.trim() || "Google User",
              email,
              passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 12),
              image: user.image,
              role: "USER",
            },
          });
          user.id = created.id;
          (user as { role?: "USER" | "ADMIN" }).role = created.role;
        }
        return true;
      } catch {
        return false;
      }
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: "USER" | "ADMIN" }).role ?? "USER";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "USER" | "ADMIN";
      }
      return session;
    },
  },
};

export async function getSession() {
  try {
    await connection();
    return await getServerSession(authOptions);
  } catch {
    return null;
  }
}

export async function requireUser() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  return session.user;
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session.user;
}
