import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function getEncryptionKey(): Buffer {
  const value = process.env.MEDIA_JOB_ENCRYPTION_KEY ?? "";
  if (!/^[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error(
      "MEDIA_JOB_ENCRYPTION_KEY must be a 64-character hexadecimal key.",
    );
  }
  return Buffer.from(value, "hex");
}

export function encryptSourceUrl(sourceUrl: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(sourceUrl, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptSourceUrl(payload: string): string {
  const [version, ivText, tagText, ciphertextText, extra] = payload.split(".");
  if (
    version !== "v1" ||
    !ivText ||
    !tagText ||
    !ciphertextText ||
    extra
  ) {
    throw new Error("Stored media source is invalid or uses an unknown version.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivText, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
