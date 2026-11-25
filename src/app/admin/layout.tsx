import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<main className="admin-shell"><div className="admin-loading">Loading admin dashboard...</div></main>}>
      <AdminGuard>{children}</AdminGuard>
    </Suspense>
  );
}

async function AdminGuard({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  if (!admin) redirect("/login");

  return <AdminShell>{children}</AdminShell>;
}
