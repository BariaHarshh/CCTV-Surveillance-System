import crypto from "crypto";

export function hashLookupToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
