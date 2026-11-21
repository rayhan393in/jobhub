import "server-only";
import { createHash } from "node:crypto";

/**
 * Normalised SHA-256 of a question statement.
 *
 * Mirrors the `encode(digest(statement, 'sha256'), 'hex')` fingerprints used by
 * the seed migrations, so the same question can never enter a course twice.
 */
export function fingerprint(statement: string): string {
  return createHash("sha256").update(statement.trim(), "utf8").digest("hex");
}
