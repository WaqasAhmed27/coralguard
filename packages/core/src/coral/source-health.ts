import { spawn } from "node:child_process";
import type { SourceHealth } from "../schemas/report.js";
import { resolveCoralBin } from "./coral-bin.js";

const sources = [
  { name: "github", required: true },
  { name: "ci_artifacts", required: true },
  { name: "sentry", required: false },
  { name: "slack", required: false },
  { name: "slack_incidents", required: false },
  { name: "support", required: false },
  { name: "launchdarkly", required: false },
  { name: "flags", required: false },
  { name: "linear", required: false },
  { name: "osv", required: false }
];

export async function getSourceHealth(mode: "demo" | "live", missingSources: string[] = []): Promise<SourceHealth[]> {
  const missing = new Set(missingSources);
  if (mode === "demo") {
    return sources.map((source) => ({
      name: source.name,
      required: source.required,
      mode: "seeded",
      status: missing.has(source.name) ? "optional_skipped" : "connected",
      message: missing.has(source.name)
        ? "Simulated missing source; assessment will continue with lower confidence."
        : "Seeded JSONL source available for reliable demo mode."
    }));
  }

  const coralAvailable = await canRunCoral();
  return sources.map((source) => ({
    name: source.name,
    required: source.required,
    mode: "live",
    status: coralAvailable ? "connected" : "not_installed",
    message: coralAvailable ? "Coral CLI detected." : "Coral CLI is not installed or not on PATH."
  }));
}

async function canRunCoral(): Promise<boolean> {
  return await new Promise((resolve) => {
    const child = spawn(resolveCoralBin(), ["--version"], { shell: false, stdio: "ignore", windowsHide: true });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}
