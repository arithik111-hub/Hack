import type { Metadata } from "next";
import { MediaDownloader } from "@/components/admin/MediaDownloader";

export const metadata: Metadata = { title: "Media downloader" };

export default function AdminDownloaderPage() {
  return (
    <div>
      <header className="admin-page-header">
        <div>
          <p>AUTHORIZED MEDIA INGESTION</p>
          <h1>Downloader</h1>
        </div>
      </header>
      <MediaDownloader />
    </div>
  );
}
