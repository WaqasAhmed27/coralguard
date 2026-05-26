import type { Evidence } from "../schemas/evidence.js";
import type { TestPlanItem } from "../schemas/report.js";

export function buildTestPlan(evidence: Evidence[]): TestPlanItem[] {
  const items: TestPlanItem[] = [];
  const ci = evidence.filter((item) => item.category === "ci_failure" && item.severity === "high");
  if (ci.length) {
    items.push({
      id: "test-failing-ci",
      title: "Fix and rerun failing regression tests",
      reason: `CI already failed on touched files: ${ci.map((item) => item.title).join(", ")}.`,
      evidenceIds: ci.map((item) => item.id)
    });
  }

  const incidents = evidence.filter((item) => item.category === "incident_history");
  if (incidents.length) {
    items.push({
      id: "test-incident-regression",
      title: "Run incident-specific regression checks",
      reason: `Changed code overlaps with prior incident evidence: ${incidents.map((item) => item.title).join(", ")}.`,
      evidenceIds: incidents.map((item) => item.id)
    });
  }

  const support = evidence.filter((item) => item.category === "customer_signal");
  if (support.length) {
    items.push({
      id: "test-customer-signal",
      title: "Verify customer-facing failure mode",
      reason: "Support clusters show recent customer impact for this service.",
      evidenceIds: support.map((item) => item.id)
    });
  }

  const flags = evidence.filter((item) => item.category === "feature_flag_exposure" && item.severity === "high");
  if (flags.length) {
    items.push({
      id: "test-flag-rollback",
      title: "Run flag rollback and low-exposure rollout test",
      reason: "The touched service is behind a highly exposed feature flag.",
      evidenceIds: flags.map((item) => item.id)
    });
  }

  const vulns = evidence.filter((item) => item.category === "security_finding");
  if (vulns.length) {
    items.push({
      id: "test-dependency-security",
      title: "Confirm dependency version is patched or exempted",
      reason: "Dependency evidence found a vulnerability in a changed package.",
      evidenceIds: vulns.map((item) => item.id)
    });
  }

  return items;
}
