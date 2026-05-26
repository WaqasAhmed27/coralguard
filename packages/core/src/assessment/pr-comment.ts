import type { Evidence } from "../schemas/evidence.js";
import type { AssessmentReport, TestPlanItem } from "../schemas/report.js";

export function recommendationFor(level: AssessmentReport["riskLevel"]): string {
  if (level === "critical") return "Block merge and escalate owner review.";
  if (level === "high") return "Delay merge until targeted checks pass.";
  if (level === "medium") return "Merge only after the targeted checks below pass.";
  return "Merge likely safe after normal review.";
}

export function buildPrCommentMarkdown(report: Omit<AssessmentReport, "prCommentMarkdown">): string {
  const topEvidence = report.evidence
    .filter((item) => ["high", "critical"].includes(item.severity))
    .slice(0, 5);
  const requiredChecks = report.testPlan.slice(0, 5);

  return [
    `## CoralGuard Merge Risk: ${capitalize(report.riskLevel)}`,
    "",
    `Recommendation: ${report.recommendation}`,
    "",
    "Top risks:",
    ...toNumbered(topEvidence.map((item) => `${item.title}: ${item.summary} (${item.id})`)),
    "",
    "Required checks:",
    ...toBullets(requiredChecks.map(formatCheck)),
    "",
    "Evidence:",
    ...toBullets(topEvidence.map((item) => `${item.source} ${item.sqlQueryId}: ${item.title} (${item.id})`)),
    "",
    `Deterministic score: ${report.riskScore}/100, confidence ${Math.round(report.confidence * 100)}%.`
  ].join("\n");
}

function formatCheck(item: TestPlanItem): string {
  return `${item.title} because ${item.reason} Evidence: ${item.evidenceIds.join(", ")}.`;
}

function toNumbered(items: string[]): string[] {
  return items.length ? items.map((item, index) => `${index + 1}. ${item}`) : ["1. No high-risk evidence found."];
}

function toBullets(items: string[]): string[] {
  return items.length ? items.map((item) => `- ${item}`) : ["- No targeted checks required from current evidence."];
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
