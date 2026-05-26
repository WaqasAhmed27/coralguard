import { existsSync } from "node:fs";
import path from "node:path";

export function resolveCoralBin(start = process.cwd()): string {
  if (process.env.CORAL_BIN) {
    return process.env.CORAL_BIN;
  }

  let current = start;
  for (let i = 0; i < 8; i += 1) {
    const candidate = path.join(current, ".tools", "coral", process.platform === "win32" ? "coral.exe" : "coral");
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return "coral";
}
