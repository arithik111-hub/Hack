import "server-only";
import { createClient } from "@supabase/supabase-js";

export function getSupabaseStorageClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getVideoBucket() {
  return process.env.SUPABASE_VIDEO_BUCKET?.trim() || "animex-videos";
}

export function getCoverBucket() {
  return process.env.SUPABASE_COVER_BUCKET?.trim() || "animex-covers";
}
