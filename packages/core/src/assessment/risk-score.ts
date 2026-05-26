import type { Evidence } from "../schemas/evidence.js";
import type { SourceHealth } from "../schemas/report.js";

export type RiskScore = {
  score: number;
  level: "low" | "medium" | "high" | "critical";
  confidence: number;
  factors: { label: string; points: number; evidenceIds: string[] }[];
};

export function calculateRiskScore(evidence: Evidence[], sourceHealth: SourceHealth[], now = new Date()): RiskScore {
  const factors: RiskScore["factors"] = [];
  const byCategory = (category: Evidence["category"]) => evidence.filter((item) => item.category === category);
  const code = byCategory("code_change");

  if (code.some((item) => item.severity === "high")) {
    add("Critical file changed", 15, code.filter((item) => item.severity === "high").map((item) => item.id));
  }
  const paymentAuthDeploy = code.filter((item) => /payment|checkout|auth|deploy/i.test(item.title));
  if (paymentAuthDeploy.length) {
    add("Payment, auth, or deploy path changed", 20, paymentAuthDeploy.map((item) => item.id));
  }

  const ciFailures = byCategory("ci_failure").filter((item) => item.severity === "high");
  if (ciFailures.length) {
    add("CI failures on changed files", Math.min(30, 15 * unique(ciFailures.map((item) => item.title)).size), ciFailures.map((item) => item.id));
  }

  const coverageDrops = byCategory("ci_failure").filter((item) => /Coverage dropped/.test(item.title) && item.severity !== "low");
  if (coverageDrops.length) {
    add("Coverage drop above threshold", 10, coverageDrops.map((item) => item.id));
  }

  const runtime = byCategory("runtime_error");
  if (runtime.length) add("Recent runtime errors in affected service", 20, runtime.map((item) => item.id));

  const incidents = byCategory("incident_history").filter((item) => withinDays(item.timestamp, 90, now));
  if (incidents.length) add("Similar incident in last 90 days", 20, incidents.map((item) => item.id));

  const support = byCategory("customer_signal");
  if (support.length) add("Support-ticket spike", 15, support.map((item) => item.id));

  const flags = byCategory("feature_flag_exposure").filter((item) => item.severity === "high");
  if (flags.length) add("Feature flag exposure above 50 percent", 10, flags.map((item) => item.id));

  const criticalVulns = byCategory("security_finding").filter((item) => item.severity === "critical" || item.severity === "high");
  if (criticalVulns.length) add("High or critical vulnerability in changed dependency", 25, criticalVulns.map((item) => item.id));

  const missingOwners = byCategory("ownership").filter((item) => item.title === "Missing owner");
  if (missingOwners.length) add("Missing code owner", 10, missingOwners.map((item) => item.id));

  const score = Math.min(100, factors.reduce((sum, factor) => sum + factor.points, 0));
  const confidence = calculateConfidence(evidence, sourceHealth, now);
  return { score, level: riskLevel(score), confidence, factors };

  function add(label: string, points: number, evidenceIds: string[]) {
    factors.push({ label, points, evidenceIds });
  }
}

export function calculateConfidence(evidence: Evidence[], sourceHealth: SourceHealth[], now = new Date()): number {
  const sources = unique(evidence.map((item) => item.source));
  let confidence = 0.5 + Math.min(0.45, sources.size * 0.1);
  const missingKeySource = sourceHealth.some((source) => source.required && source.status !== "connected");
  if (missingKeySource) confidence -= 0.15;
  if (evidence.some((item) => item.timestamp && !withinDays(item.timestamp, 90, now))) confidence -= 0.1;
  return Math.max(0.1, Math.min(0.95, Number(confidence.toFixed(2))));
}

function riskLevel(score: number): RiskScore["level"] {
  if (score >= 85) return "critical";
  if (score >= 60) return "high";
  if (score >= 30) return "medium";
  return "low";
}

function unique(values: string[]): Set<string> {
  return new Set(values.filter(Boolean));
}

function withinDays(timestamp: string | null, days: number, now: Date): boolean {
  if (!timestamp) return false;
  const time = new Date(timestamp).getTime();
  if (Number.isNaN(time)) return false;
  return now.getTime() - time <= days * 24 * 60 * 60 * 1000;
}
