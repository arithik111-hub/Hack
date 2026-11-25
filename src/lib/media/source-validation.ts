import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export class MediaInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaInputError";
  }
}

export function getAllowedSourceHosts(): Set<string> {
  return new Set(
    (process.env.MEDIA_ALLOWED_SOURCE_HOSTS ?? "")
      .split(",")
      .map((host) => host.trim().toLowerCase().replace(/\.$/, ""))
      .filter(Boolean),
  );
}

function isPublicIpv4(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => part < 0 || part > 255)) {
    return false;
  }
  const [a, b, c] = octets;
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

export async function validateSourceUrl(
  input: string,
  allowedHosts: ReadonlySet<string> = getAllowedSourceHosts(),
  resolveAddresses: (hostname: string) => Promise<string[]> = async (hostname) =>
    (await lookup(hostname, { all: true, verbatim: true })).map(
      (entry) => entry.address,
    ),
): Promise<{ url: URL; addresses: string[] }> {
  if (input.length > 2048) {
    throw new MediaInputError("Source URL must be 2048 characters or fewer.");
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new MediaInputError("Enter a valid direct media download URL.");
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    (url.port && url.port !== "443") ||
    !hostname ||
    isIP(hostname)
  ) {
    throw new MediaInputError(
      "Sources must be HTTPS URLs without credentials, fragments, custom ports, or IP addresses.",
    );
  }
  if (!allowedHosts.has(hostname)) {
    throw new MediaInputError(
      "That source host is not allowlisted. Add its exact hostname to MEDIA_ALLOWED_SOURCE_HOSTS.",
    );
  }

  let addresses: string[];
  try {
    addresses = await resolveAddresses(hostname);
  } catch {
    throw new MediaInputError("The allowlisted source host could not be resolved.");
  }
  const publicIpv4 = addresses.filter((address) => isIP(address) === 4);
  if (!publicIpv4.length || publicIpv4.some((address) => !isPublicIpv4(address))) {
    throw new MediaInputError(
      "The source host must resolve only to public IPv4 addresses.",
    );
  }

  return { url, addresses: publicIpv4 };
}

export function detectVideoType(
  bytes: Uint8Array,
  contentType: string | null,
): { mimeType: string; sourceType: "MP4" | "OTHER" } {
  const mime = contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
  const hasFtyp =
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(4, 8)) === "ftyp";
  const isWebm =
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3;

  if (isWebm && (mime === "video/webm" || mime === "application/octet-stream")) {
    return { mimeType: "video/webm", sourceType: "OTHER" };
  }
  if (
    hasFtyp &&
    (mime === "video/mp4" ||
      mime === "video/quicktime" ||
      mime === "application/octet-stream")
  ) {
    return {
      mimeType: mime === "video/quicktime" ? "video/quicktime" : "video/mp4",
      sourceType: "MP4",
    };
  }
  throw new MediaInputError(
    "The source is not a supported MP4, MOV, or WebM video file. Streaming playlists and DRM-protected streams are not accepted.",
  );
}
