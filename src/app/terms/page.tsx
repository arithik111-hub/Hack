import Link from "next/link";
import { Icon } from "@/components/animex/Icon";

export default function TermsPage() {
  return (
    <main className="state-page">
      <article className="state-card policy-content">
        <Link className="state-back-link" href="/">
          <Icon name="arrow-left" size={16} />
          Back to ANIMEX
        </Link>
        <p className="eyebrow state-eyebrow">ANIMEX PROTOTYPE</p>
        <h1>Terms of service</h1>
        <p>
          ANIMEX currently provides sample anime descriptions and discovery
          tools for demonstration. Catalog details may be incomplete and are
          not a substitute for provider listings.
        </p>
        <h2>No video hosting</h2>
        <p>
          This site does not host, distribute, or link to anime video streams.
          Playback remains unavailable until a verified, authorized provider
          integration is in place.
        </p>
        <h2>Third-party artwork</h2>
        <p>
          Artwork is served by Unsplash and is subject to its applicable
          terms. Anime titles and associated marks belong to their respective
          rights holders.
        </p>
        <h2>Before public launch</h2>
        <p>
          These prototype terms are informational and should be reviewed for
          your jurisdiction and replaced with complete legal terms before
          launching a public service.
        </p>
      </article>
    </main>
  );
}
