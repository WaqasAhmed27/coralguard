import type { ParsedPr } from "../schemas/input.js";
import type { Evidence } from "../schemas/evidence.js";
import type { RollbackPlan } from "../schemas/report.js";

export function buildRollbackPlan(input: ParsedPr, evidence: Evidence[]): RollbackPlan {
  const flags = evidence.filter((item) => item.category === "feature_flag_exposure").map((item) => item.title);
  const owners = evidence.filter((item) => item.category === "ownership" && item.title !== "Missing owner").map((item) => item.title);
  const runtime = evidence.filter((item) => item.category === "runtime_error");

  return {
    revertCommand: `git revert -m 1 <merge_commit_for_pr_${input.prNumber}>`,
    featureFlagActions: flags.length ? flags.map((flag) => `Reduce ${flag} rollout to 10% or disable for high-risk segments.`) : ["No feature flag rollback identified."],
    ownersToNotify: Array.from(new Set(owners)).sort(),
    metricsToWatch: ["checkout latency p95", "payment timeout rate", "duplicate charge ticket volume"],
    sentryQueries: runtime.map((item) => `issue:${item.entityRefs[0]} service:${item.entityRefs[1]}`).filter(Boolean),
    notes: ["Do not execute rollback automatically; this is a human-reviewed plan."]
  };
}
