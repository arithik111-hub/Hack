import type { Metadata } from "next";
import AnimeImporter from "@/components/admin/AnimeImporter";

export const metadata: Metadata = { title: "Anime Importer" };

export default function ImportAnimePage() {
  return <AnimeImporter />;
}
