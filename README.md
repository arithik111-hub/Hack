# ANIMEX

ANIMEX is a responsive anime discovery site built with Next.js App Router, React, TypeScript, and Tailwind CSS.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Features

- Featured anime carousel, searchable catalog, and genre filters.
- Recently added, latest, popular, and top-rated published anime sections.
- Responsive navigation and layouts for desktop and mobile.
- A PostgreSQL-backed public catalogue with genre, year, status, rating, type, and language filters.
- Anime detail pages with alternative titles, studio, languages, seasons, and episode metadata.
- Instant search by title, alternate title, and genre, plus dedicated genre pages.
- Browser-local watchlist controls and page sharing.
- Sample episode records with season-specific lists and clear playback-unavailable messaging.
- Privacy, terms, contact, and account-status pages.

## Catalog, seasons, and artwork

Published anime, season, and episode records are read from PostgreSQL through Prisma. `src/data/anime.ts` contains development seed and design-reference data; database errors are surfaced instead of silently substituting sample titles on public pages.

Artwork is requested from Unsplash and displayed with Next.js image optimization; gradient artwork fallbacks are used if a remote image cannot load.

The episode list is demonstration metadata, not a video catalogue. Episode dates and descriptions are sample values. No video sources are configured.

## Playback status

ANIMEX does not provide video streams. Episode pages clearly show that playback is unavailable until an authorized provider is configured. Only verified, authorized providers should be integrated in the future.

## Routes

- `/anime` — filterable and sortable anime catalogue.
- `/anime/[slug]` — anime information, seasons, and sample episodes.
- `/search` — instant search and suggestions.
- `/genres` and `/genres/[slug]` — genre directory and filtered titles.
- `/watch/[slug]` and `/watch/[slug]/[episodeId]` — playback status and episode details.
- `/admin/downloader` — admin-only authorized media import queue and approval controls.
- `/admin/import` — administrator-only AniList, Jikan, and Kitsu search, preview, import, and metadata refresh.
- `/templates` — design-reference page for the public catalogue layout.

## Multi-provider anime importer

The admin importer uses three free public APIs without API keys:

- AniList GraphQL (`https://graphql.anilist.co`) is primary; responses are cached in-process for five minutes and limited to 60 requests per minute per server process.
- Jikan v4 (`https://api.jikan.moe/v4`) is the second provider; responses are cached for 24 hours and limited to three requests per second and 60 per minute per server process.
- Kitsu JSON:API (`https://kitsu.io/api/edge`) is the final fallback; responses are cached for six hours and limited to five requests per second and 60 per minute per server process.

Search falls back when a provider is unavailable or has no matches. Catalogue filters include popular, recently released, currently airing, completed, upcoming, movies, and TV series. Open `/admin/import`, search or browse, preview the provider data, edit fields, and choose whether to publish. Import defaults to publishing so approved titles appear on the public site immediately; admins can instead save as a draft. Duplicate checks include AniList, MyAnimeList/Jikan, Kitsu IDs, matching titles, and URL slugs.

Imports create anime and genre metadata only; they do not create season or episode records or provide playback sources. Artwork URLs stay attributed to their provider and are not downloaded or re-hosted by the importer. Admins can manually refresh provider metadata from an anime's edit page; manually uploaded cover art is preserved. The public home page uses published database records for recently added, latest, popular, and top-rated sections.

The additive `20261125160000_multi_provider_import` migration adds Kitsu IDs, title variants, season, duration, source material, official website, metadata source, sync timestamps, and custom-cover tracking. It also enables RLS, restricts direct writes, and grants public reads only for published anime and related catalogue rows. Admin imports and refreshes remain protected by the ANIMEX admin session:

```powershell
npm run db:generate
npm run db:deploy
```

No new environment variables or provider API keys are required. Keep database and Supabase credentials server-side. Imported metadata is attributed on anime cards and detail pages; providers do not supply ANIMEX with episode media sources or authorization to stream third-party video.

## Anime cover uploads

Anime management lets administrators upload a cover from each anime's edit page. PNG, JPEG, WebP, and AVIF files up to 10 MB are uploaded server-side to the public `animex-covers` Supabase Storage bucket, then assigned to that anime's poster. The service-role key stays server-side; only authenticated administrators can upload. Set `SUPABASE_COVER_BUCKET` to use a different bucket name.

## Validation

```bash
npm run lint
npx tsc --noEmit
npm run test:providers
npm run build
```

## PostgreSQL and authentication setup

ANIMEX uses Prisma 7 with PostgreSQL and NextAuth credentials authentication.

1. Copy `.env.example` to `.env.local`.
2. Set `DATABASE_URL` to a Supabase, Neon, or standard PostgreSQL connection string.
3. Set `AUTH_SECRET` to a long random value.
4. Generate Prisma Client:

```powershell
npm run db:generate
```

5. Apply the initial migration without resetting or dropping existing data:

```powershell
npm run db:deploy
```

For local migration development, use `npm run db:migrate` instead.

6. Seed the safe, repeatable catalogue:

```powershell
npm run db:seed
```

To promote the first administrator through seed configuration, add placeholder credentials only to `.env.local`:

```text
INITIAL_ADMIN_EMAIL="admin@example.com"
INITIAL_ADMIN_PASSWORD="Use-a-long-random-password"
```

Then run `npm run db:seed`. Remove `INITIAL_ADMIN_PASSWORD` after seeding. Promotion is server-side and never changes user roles through public registration.

Open `/register` to create a normal account, `/login` to sign in, and `/admin` for an administrator.

## Database rollback

Do not use `prisma migrate reset` or destructive database commands. To undo a migration, use a forward corrective migration or restore a tested database backup. This project does not reset Supabase or existing database records.

## Google sign-in setup

1. Create a Google OAuth web client in Google Cloud Console.
2. Add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI.
3. Add the client ID and secret to `.env.local`:

```text
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
NEXT_PUBLIC_GOOGLE_LOGIN="true"
```

Google sign-in creates a normal `USER` account. Existing administrator roles are preserved.

## Supabase private video uploads

1. Create a Supabase project and private Storage bucket for videos.
2. Add these server-only values to `.env.local`:

```text
SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
SUPABASE_VIDEO_BUCKET="animex-videos"
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser code or prefix it with `NEXT_PUBLIC_`.

Open `/admin/video-sources` as an administrator, select an episode, and upload an MP4, WebM, or QuickTime file up to 100 MB. The service stores the bucket/object reference in `VideoSource`; no public protected stream is generated. Playback should use short-lived signed URLs from a future authorized player integration.

## Authorized media downloader

The admin downloader is available at `/admin/downloader`. It only accepts direct HTTPS media URLs from exact hostnames configured in `MEDIA_ALLOWED_SOURCE_HOSTS`; it does not scrape websites, follow unapproved redirects, download playlists, or bypass DRM/access controls. Admins must record and confirm the rights basis for each job.

The worker streams downloads to a private local temp directory and streams uploads to Cloudflare Stream, Bunny Stream, or Mux. Job state and progress are stored in PostgreSQL. Uploaded sources remain disabled until an admin approves them. Publishing an episode is a separate explicit action.

Add these server-only values to `.env.local`:

```text
MEDIA_ALLOWED_SOURCE_HOSTS="downloads.your-authorized-domain.example"
MEDIA_JOB_ENCRYPTION_KEY="64-hex-characters-from-a-random-32-byte-key"
MEDIA_DOWNLOAD_DIR="./temp/media-ingestion"
MEDIA_MAX_FILE_BYTES="1073741824"
MEDIA_DOWNLOAD_TIMEOUT_MS="1200000"
MEDIA_WORKER_CONCURRENCY="1"
```

Generate a key in a local terminal and keep it private:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Configure at least one upload provider:

```text
# Cloudflare Stream
CLOUDFLARE_ACCOUNT_ID=""
CLOUDFLARE_STREAM_API_TOKEN=""

# Bunny Stream
BUNNY_STREAM_LIBRARY_ID=""
BUNNY_STREAM_API_KEY=""

# Mux
MUX_TOKEN_ID=""
MUX_TOKEN_SECRET=""
```

Apply the additive job migration (it does not reset or delete existing data):

```powershell
npm run db:generate
npm run db:deploy
```

Start the app and the persistent worker in separate terminals:

```powershell
npm run dev
npm run media:worker
```

Keep the worker running for queue processing. It uses database leases to recover interrupted downloads after restarts, resumes partial downloads when the source supports byte ranges, and limits concurrency to one by default (maximum three). Keep `MEDIA_DOWNLOAD_DIR` on persistent local storage if resume-after-restart behavior is required. Cloudflare's basic upload adapter is limited to files smaller than 200 MB; the configured global size limit is additionally enforced while streaming.

The worker requires a reachable public IPv4 source address, exact hostname allowlisting, HTTPS on port 443, and supported MP4/MOV/WebM file signatures. Use a provider account with private/signed playback configured. Mux assets are created with signed playback policy. Public player integration and provider playback-token signing remain separate from this ingestion feature; no provider credentials are exposed to the browser.

Keep the same `MEDIA_JOB_ENCRYPTION_KEY` available to every worker and preserve it while queued jobs exist; changing it makes their stored source URLs unreadable. Bunny Stream token-auth playback configuration is managed in Bunny's dashboard. This importer does not scrape sites, extract streams, bypass DRM, or integrate ToonPlay.
