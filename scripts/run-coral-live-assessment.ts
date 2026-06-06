import path from "node:path";
import { assessPullRequest, CoralCliClient, resolveCoralBin } from "@coralguard/core";

process.env.CORAL_BIN ??= resolveCoralBin();
process.env.CORAL_CONFIG_DIR ??= path.resolve(process.cwd(), ".coral-config");
process.env.CORAL_QUERY_PROFILE ??= "demo";

const input = process.argv[2] ?? "https://github.com/demo/shop/pull/214";
const report = await assessPullRequest(
  {
    prUrl: input,
    mode: "live",
    redaction: "strict"
  },
  {
    client: new CoralCliClient(
      process.env.CORAL_BIN,
      Number(process.env.CORAL_QUERY_TIMEOUT_MS ?? 20_000),
      process.env.CORAL_QUERY_PROFILE === "live" ? "live" : "demo"
    ),
    now: new Date("2026-05-26T12:00:00Z")
  }
);

console.log(JSON.stringify({
  coralBin: process.env.CORAL_BIN,
  coralConfigDir: process.env.CORAL_CONFIG_DIR,
  riskLevel: report.riskLevel,
  riskScore: report.riskScore,
  confidence: report.confidence,
  evidenceCount: report.evidence.length,
  queryRows: Object.fromEntries(report.querySummaries.map((query) => [query.id, query.rowCount])),
  warnings: report.warnings
}, null, 2));
