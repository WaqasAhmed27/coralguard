import { createHash } from "node:crypto";

export function stableHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(sortObject(value))).digest("hex").slice(0, 16);
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, sortObject(child)])
    );
  }
  return value;
}
