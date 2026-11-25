import type { Metadata } from "next";
import { VideoSourceManager } from "@/components/admin/VideoSourceManager";

export const metadata: Metadata = { title: "Video sources" };

export default async function AdminVideoSourcesPage() {
  return (
    <div>
      <header className="admin-page-header">
        <div><p>AUTHORIZED PROVIDERS</p><h1>Video sources</h1></div>
      </header>
      <VideoSourceManager />
    </div>
  );
}
