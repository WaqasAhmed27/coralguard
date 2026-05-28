import { spawn } from "node:child_process";
import type { SourceHealth } from "../schemas/report.js";
import { redactForDisplay } from "../security/redact.js";
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
  if (!coralAvailable) {
    return sources.map((source) => ({
      name: source.name,
      required: source.required,
      mode: "live",
      status: "not_installed",
      message: "Coral CLI is not installed or not on PATH."
    }));
  }

  return await Promise.all(sources.map((source) => testLiveSource(source.name, source.required)));
}

async function canRunCoral(): Promise<boolean> {
  return await new Promise((resolve) => {
    const child = spawn(resolveCoralBin(), ["--version"], { shell: false, stdio: "ignore", windowsHide: true });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

async function testLiveSource(name: string, required: boolean): Promise<SourceHealth> {
  const result = await runCoral(["source", "test", name], 15_000);
  if (result.ok) {
    return {
      name,
      required,
      mode: "live",
      status: "connected",
      message: "Coral source validation passed."
    };
  }

  const output = result.output.toLowerCase();
  const status = output.includes("was not found") || output.includes("source not found") ? "not_installed" : "failing";
  return {
    name,
    required,
    mode: "live",
    status,
    message: redactForDisplay(result.output || "Coral source validation failed.")
  };
}

async function runCoral(args: string[], timeoutMs: number): Promise<{ ok: boolean; output: string }> {
  return await new Promise((resolve) => {
    const child = spawn(resolveCoralBin(), args, { shell: false, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let output = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({ ok: false, output: `Coral command timed out after ${timeoutMs}ms.` });
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      resolve({ ok: false, output: error.message });
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({ ok: code === 0, output });
    });
  });
}
