import { assessPullRequest } from "@coralguard/core";

const input = process.argv[2] ?? "https://github.com/demo/shop/pull/214";
const report = await assessPullRequest({
  prUrl: input,
  mode: "demo",
  redaction: "strict"
}, { now: new Date("2026-05-26T12:00:00Z") });

console.log(JSON.stringify({
  assessmentId: report.assessmentId,
  riskLevel: report.riskLevel,
  riskScore: report.riskScore,
  confidence: report.confidence,
  evidenceCount: report.evidence.length,
  topEvidence: report.evidence.slice(0, 5).map((item) => ({
    id: item.id,
    source: item.source,
    title: item.title
  }))
}, null, 2));
