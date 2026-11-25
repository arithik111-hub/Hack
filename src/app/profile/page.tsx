import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { PageNavigation } from "@/components/animex/PageNavigation";
import { ProfileForm } from "@/components/profile/ProfileForm";

export const metadata: Metadata = { title: "My profile" };

export default function ProfilePage() {
  return (
    <>
      <PageNavigation />
      <Suspense fallback={<main className="state-page"><div className="state-card">Loading profile...</div></main>}>
        <ProfileContent />
      </Suspense>
    </>
  );
}

async function ProfileContent() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const db = getDatabase();
  const profile = await db.user.findUnique({
    where: { id: user.id },
    select: { id: true, name: true, email: true, image: true, role: true, createdAt: true },
  });
  if (!profile) redirect("/login");
  return (
    <main className="state-page">
      <article className="state-card profile-card">
        <p className="eyebrow state-eyebrow">ANIMEX ACCOUNT</p>
        <h1>{profile.name}</h1>
        <div className="profile-facts">
          <div><span>Email</span><strong>{profile.email}</strong></div>
          <div><span>Role</span><strong>{profile.role}</strong></div>
          <div><span>Member since</span><strong>{profile.createdAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</strong></div>
        </div>
        <ProfileForm name={profile.name} image={profile.image} />
      </article>
    </main>
  );
}
