import type { QueryResult } from "../coral/query-runner.js";
import type { QueryRow } from "../coral/coral-client.js";
import type { Evidence, EvidenceCategory, Severity } from "../schemas/evidence.js";
import { redactForDisplay } from "../security/redact.js";
import { containsPromptInjection } from "../security/prompt-injection.js";
import { stableHash } from "../utils/hash.js";

export function normalizeEvidence(results: QueryResult[], strictRedaction = false): Evidence[] {
  const evidence = results.flatMap((result) =>
    result.rows.map((row, index) => rowToEvidence(result.queryId, row, index, strictRedaction)).filter(Boolean)
  ) as Evidence[];
  return dedupeEvidence(evidence);
}

export function dedupeEvidence(evidence: Evidence[]): Evidence[] {
  const seen = new Set<string>();
  return evidence.filter((item) => {
    const key = `${item.category}:${item.rawRowHash}:${item.entityRefs.join("|")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function rowToEvidence(queryId: string, row: QueryRow, index: number, strict: boolean): Evidence | null {
  const hash = stableHash(row);
  const base = {
    id: `EV-${queryId.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}-${index + 1}`,
    source: sourceFromQuery(queryId),
    confidence: containsPromptInjection(JSON.stringify(row)) ? 0.7 : 0.85,
    sqlQueryId: queryId,
    rawRowHash: hash
  };

  switch (queryId) {
    case "github.changed_files":
      return {
        ...base,
        category: "code_change",
        title: String(row.file_path),
        summary: redactForDisplay(`${row.service ?? "unknown service"} changed with ${row.additions ?? 0} additions and ${row.deletions ?? 0} deletions.`, strict),
        severity: fileSeverity(row),
        timestamp: null,
        entityRefs: [String(row.file_path), String(row.service ?? "unknown")]
      };
    case "ci.failures_for_changed_files":
      return {
        ...base,
        category: "ci_failure",
        title: String(row.test_name),
        summary: redactForDisplay(String(row.failure_message), strict),
        severity: "high",
        timestamp: utc(row.failed_at),
        entityRefs: [String(row.test_name), String(row.file_path)]
      };
    case "ci.coverage_for_changed_files": {
      const drop = Number(row.before_percent ?? 0) - Number(row.after_percent ?? 0);
      if (drop <= 0) return null;
      return {
        ...base,
        category: "ci_failure",
        title: `Coverage dropped for ${row.file_path}`,
        summary: `Coverage changed from ${row.before_percent}% to ${row.after_percent}% (${drop.toFixed(1)} point drop).`,
        severity: drop > 5 ? "medium" : "low",
        timestamp: utc(row.changed_at),
        entityRefs: [String(row.file_path)]
      };
    }
    case "risk.recent_errors_by_service":
      return {
        ...base,
        category: "runtime_error",
        title: String(row.title),
        summary: redactForDisplay(`${row.event_count_7d} events in the last 7 days for ${row.service} ${row.route ?? ""}.`, strict),
        severity: normalizeSeverity(row.severity, "high"),
        timestamp: utc(row.last_seen_at),
        entityRefs: [String(row.issue_id), String(row.service)]
      };
    case "risk.related_incidents_by_file":
      return {
        ...base,
        category: "incident_history",
        title: String(row.incident_id),
        summary: redactForDisplay(String(row.summary), strict),
        severity: normalizeSeverity(row.severity, "high"),
        timestamp: utc(row.occurred_at),
        entityRefs: [String(row.incident_id), String(row.service ?? row.file_path)]
      };
    case "risk.support_tickets_by_keyword":
      return {
        ...base,
        category: "customer_signal",
        title: `Support cluster ${row.cluster_id}`,
        summary: redactForDisplay(`${row.ticket_count_7d} tickets in ${row.queue}: ${row.summary}`, strict),
        severity: Number(row.ticket_count_7d ?? 0) >= 10 ? "high" : "medium",
        timestamp: utc(row.latest_ticket_at),
        entityRefs: [String(row.cluster_id), String(row.customer_segment), String(row.service)]
      };
    case "risk.flag_exposure_by_service":
      return {
        ...base,
        category: "feature_flag_exposure",
        title: String(row.flag_key),
        summary: `${row.flag_key} is enabled for ${row.rollout_percent ?? "unknown"}% of ${row.segment ?? "users"}.`,
        severity: Number(row.rollout_percent ?? 0) > 50 ? "high" : "medium",
        timestamp: utc(row.updated_at),
        entityRefs: [String(row.flag_key), String(row.service)]
      };
    case "risk.vulnerabilities_by_dependency":
      return {
        ...base,
        category: "security_finding",
        title: String(row.osv_id),
        summary: redactForDisplay(`${row.package_name}@${row.affected_version}: ${row.summary}`, strict),
        severity: normalizeSeverity(row.severity, "medium"),
        timestamp: utc(row.published_at),
        entityRefs: [String(row.osv_id), String(row.package_name)]
      };
    case "risk.owner_resolution":
      return {
        ...base,
        category: "ownership",
        title: String(row.owner_team ?? "Missing owner"),
        summary: row.owner_team
          ? `${row.file_path} is owned by ${row.owner_team}; on-call ${row.on_call ?? "unknown"}.`
          : `${row.file_path} has no CODEOWNERS match.`,
        severity: row.owner_team ? "low" : "medium",
        timestamp: null,
        entityRefs: [String(row.file_path), String(row.owner_team ?? "missing")]
      };
    default:
      return null;
  }
}

function sourceFromQuery(queryId: string): string {
  if (queryId.startsWith("github")) return "github";
  if (queryId.startsWith("ci")) return "ci_artifacts";
  if (queryId.includes("errors")) return "sentry";
  if (queryId.includes("incidents")) return "slack_incidents";
  if (queryId.includes("support")) return "support";
  if (queryId.includes("flag")) return "flags";
  if (queryId.includes("vulnerabilities")) return "osv";
  return "ci_artifacts";
}

function fileSeverity(row: QueryRow): Severity {
  if (row.criticality === "critical") return "high";
  if (row.criticality === "high") return "medium";
  return "low";
}

function normalizeSeverity(value: unknown, fallback: Severity): Severity {
  return value === "low" || value === "medium" || value === "high" || value === "critical" ? value : fallback;
}

function utc(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
