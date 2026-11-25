import { Suspense } from "react";
import HomeExperience from "@/components/animex/HomeExperience";
import { getPublishedAnimeCatalog } from "@/lib/public-content";

export default function Home() {
  return (
    <Suspense fallback={<main className="state-page"><div className="state-card" role="status">Loading ANIMEX...</div></main>}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const catalog = await getPublishedAnimeCatalog();
  return <HomeExperience catalog={catalog} />;
}
