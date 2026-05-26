import type { Evidence } from "../schemas/evidence.js";
import type { BlastRadius } from "../schemas/report.js";

export function buildBlastRadius(evidence: Evidence[]): BlastRadius {
  const services = pickRefs(evidence, ["code_change", "runtime_error", "customer_signal", "feature_flag_exposure"], 1);
  const flags = evidence.filter((item) => item.category === "feature_flag_exposure").map((item) => item.title);
  const segments = evidence.filter((item) => item.category === "customer_signal").flatMap((item) => item.entityRefs.slice(1, 2));
  const owners = evidence.filter((item) => item.category === "ownership" && item.title !== "Missing owner").map((item) => item.title);
  const onCall = evidence
    .filter((item) => item.category === "ownership")
    .map((item) => item.summary.match(/on-call ([^.]+)/)?.[1])
    .filter((value): value is string => Boolean(value && value !== "unknown"));

  return {
    affectedServices: unique(services),
    affectedRoutes: unique(evidence.filter((item) => item.category === "runtime_error").flatMap((item) => item.entityRefs.slice(1))),
    featureFlags: unique(flags),
    customerSegments: unique(segments),
    supportQueues: unique(evidence.filter((item) => item.category === "customer_signal").map(() => "payments-support")),
    codeOwners: unique(owners),
    onCallOwners: unique(onCall)
  };
}

function pickRefs(evidence: Evidence[], categories: Evidence["category"][], refIndex: number): string[] {
  return evidence.filter((item) => categories.includes(item.category)).map((item) => item.entityRefs[refIndex]).filter(Boolean);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values)).filter(Boolean).sort();
}
