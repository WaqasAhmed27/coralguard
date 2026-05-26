import { describe, expect, it } from "vitest";
import { assessPullRequest } from "../src/assessment/assess-pr.js";

const now = new Date("2026-05-26T12:00:00Z");

describe("assessment pipeline", () => {
  it("produces high evidence-backed risk for risky payment PR", async () => {
    const report = await assessPullRequest({ prUrl: "https://github.com/demo/shop/pull/214", mode: "demo", redaction: "strict" }, { now });
    expect(["high", "critical"]).toContain(report.riskLevel);
    expect(report.riskScore).toBeGreaterThanOrEqual(60);
    expect(report.evidence.length).toBeGreaterThanOrEqual(8);
    expect(new Set(report.evidence.map((item) => item.category)).size).toBeGreaterThanOrEqual(5);
    expect(report.prCommentMarkdown).not.toContain("fakeSecretValue");
    expect(report.prCommentMarkdown).toContain("EV-");
  });

  it("keeps docs-only PR low risk", async () => {
    const report = await assessPullRequest({ prUrl: "demo/shop#7", mode: "demo" }, { now });
    expect(report.riskLevel).toBe("low");
    expect(report.riskScore).toBeLessThan(30);
    expect(report.evidence.some((item) => item.category === "runtime_error")).toBe(false);
  });

  it("degrades confidence when required sources are missing", async () => {
    const normal = await assessPullRequest({ prUrl: "demo/shop#214", mode: "demo" }, { now });
    const degraded = await assessPullRequest({ prUrl: "demo/shop#214", mode: "demo", missingSources: ["ci_artifacts"] }, { now });
    expect(degraded.confidence).toBeLessThan(normal.confidence);
    expect(degraded.sourceHealth.find((source) => source.name === "ci_artifacts")?.status).toBe("optional_skipped");
  });
});
