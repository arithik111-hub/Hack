import type { NextConfig } from "next";

const coverBucket = process.env.SUPABASE_COVER_BUCKET?.trim() || "animex-covers";
const supabaseCoverPattern = process.env.SUPABASE_URL
  ? {
      protocol: "https" as const,
      hostname: new URL(process.env.SUPABASE_URL).hostname,
      pathname: `/storage/v1/object/public/${coverBucket}/**`,
    }
  : null;

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.anilist.co",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cdn.myanimelist.net",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "media.kitsu.app",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "media.kitsu.io",
        pathname: "/**",
      },
      ...(supabaseCoverPattern ? [supabaseCoverPattern] : []),
    ],
  },
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
