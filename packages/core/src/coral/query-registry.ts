import type { ParsedPr } from "../schemas/input.js";

export type QueryId =
  | "github.pr_summary"
  | "github.changed_files"
  | "ci.failures_for_changed_files"
  | "ci.coverage_for_changed_files"
  | "risk.recent_errors_by_service"
  | "risk.related_incidents_by_file"
  | "risk.support_tickets_by_keyword"
  | "risk.flag_exposure_by_service"
  | "risk.vulnerabilities_by_dependency"
  | "risk.owner_resolution";

export type QueryDefinition = {
  id: QueryId;
  label: string;
  sources: string[];
  sql: string;
};

export const queryRegistry: Record<QueryId, QueryDefinition> = {
  "github.pr_summary": {
    id: "github.pr_summary",
    label: "GitHub PR summary",
    sources: ["github"],
    sql: `
SELECT owner, repo, pr_number, title, body, author, head_sha, base_branch, created_at, updated_at
FROM github.pull_requests
WHERE owner = :owner AND repo = :repo AND pr_number = :pr_number
LIMIT 1`
  },
  "github.changed_files": {
    id: "github.changed_files",
    label: "Changed files and service mapping",
    sources: ["github"],
    sql: `
SELECT owner, repo, pr_number, file_path, additions, deletions, service, route, dependency_name, criticality
FROM github.pull_request_files
WHERE owner = :owner AND repo = :repo AND pr_number = :pr_number
ORDER BY criticality DESC, file_path
LIMIT 200`
  },
  "ci.failures_for_changed_files": {
    id: "ci.failures_for_changed_files",
    label: "CI failures overlapping changed files",
    sources: ["github", "ci_artifacts"],
    sql: `
WITH changed AS (
  SELECT file_path
  FROM github.pull_request_files
  WHERE owner = :owner AND repo = :repo AND pr_number = :pr_number
),
failures AS (
  SELECT pr_number, test_name, file_path, failure_message, failed_at
  FROM ci_artifacts.test_failures
  WHERE pr_number = :pr_number
)
SELECT failures.test_name, failures.file_path, failures.failure_message, failures.failed_at
FROM failures
JOIN changed ON failures.file_path = changed.file_path
LIMIT 50`
  },
  "ci.coverage_for_changed_files": {
    id: "ci.coverage_for_changed_files",
    label: "Coverage changes for touched files",
    sources: ["github", "ci_artifacts"],
    sql: `
WITH changed AS (
  SELECT file_path
  FROM github.pull_request_files
  WHERE owner = :owner AND repo = :repo AND pr_number = :pr_number
)
SELECT coverage.file_path, coverage.before_percent, coverage.after_percent, coverage.changed_at
FROM ci_artifacts.coverage_changes AS coverage
JOIN changed ON coverage.file_path = changed.file_path
LIMIT 50`
  },
  "risk.recent_errors_by_service": {
    id: "risk.recent_errors_by_service",
    label: "Recent runtime errors in affected services",
    sources: ["github", "sentry"],
    sql: `
WITH services AS (
  SELECT DISTINCT service
  FROM github.pull_request_files
  WHERE owner = :owner AND repo = :repo AND pr_number = :pr_number AND service IS NOT NULL
)
SELECT issue_id, title, service, route, event_count_7d, last_seen_at, severity
FROM sentry.issues
JOIN services USING (service)
WHERE event_count_7d > 0
ORDER BY event_count_7d DESC
LIMIT 25`
  },
  "risk.related_incidents_by_file": {
    id: "risk.related_incidents_by_file",
    label: "Historical incidents related to changed files",
    sources: ["github", "slack_incidents"],
    sql: `
WITH changed AS (
  SELECT file_path, service
  FROM github.pull_request_files
  WHERE owner = :owner AND repo = :repo AND pr_number = :pr_number
)
SELECT DISTINCT
  incidents.incident_id,
  incidents.channel,
  incidents.service,
  incidents.file_path,
  incidents.summary,
  incidents.severity,
  incidents.occurred_at
FROM slack_incidents.incidents AS incidents
JOIN changed ON incidents.service = changed.service OR incidents.file_path = changed.file_path
ORDER BY occurred_at DESC
LIMIT 25`
  },
  "risk.support_tickets_by_keyword": {
    id: "risk.support_tickets_by_keyword",
    label: "Support ticket clusters for affected services",
    sources: ["github", "support"],
    sql: `
WITH services AS (
  SELECT DISTINCT service
  FROM github.pull_request_files
  WHERE owner = :owner AND repo = :repo AND pr_number = :pr_number
)
SELECT cluster_id, service, queue, customer_segment, ticket_count_7d, summary, latest_ticket_at
FROM support.ticket_clusters
JOIN services USING (service)
WHERE ticket_count_7d > 0
ORDER BY ticket_count_7d DESC
LIMIT 10`
  },
  "risk.flag_exposure_by_service": {
    id: "risk.flag_exposure_by_service",
    label: "Feature flag rollout exposure",
    sources: ["github", "flags"],
    sql: `
WITH services AS (
  SELECT DISTINCT service
  FROM github.pull_request_files
  WHERE owner = :owner AND repo = :repo AND pr_number = :pr_number
)
SELECT flag_key, service, rollout_percent, segment, updated_at
FROM flags.rollouts
JOIN services USING (service)
LIMIT 25`
  },
  "risk.vulnerabilities_by_dependency": {
    id: "risk.vulnerabilities_by_dependency",
    label: "Dependency vulnerabilities introduced by PR",
    sources: ["github", "ci_artifacts", "osv"],
    sql: `
WITH changed_deps AS (
  SELECT dependency_name, from_version, to_version
  FROM ci_artifacts.dependency_diff
  WHERE pr_number = :pr_number
)
SELECT osv_id, package_name, affected_version, severity, summary, published_at
FROM osv.vulnerabilities
JOIN changed_deps ON vulnerabilities.package_name = changed_deps.dependency_name
LIMIT 25`
  },
  "risk.owner_resolution": {
    id: "risk.owner_resolution",
    label: "CODEOWNERS resolution for changed files",
    sources: ["github", "ci_artifacts"],
    sql: `
WITH changed AS (
  SELECT file_path, service
  FROM github.pull_request_files
  WHERE owner = :owner AND repo = :repo AND pr_number = :pr_number
)
SELECT changed.file_path, changed.service, codeowners.owner_team, codeowners.on_call
FROM changed
LEFT JOIN ci_artifacts.codeowners AS codeowners
  ON changed.file_path LIKE codeowners.path_prefix || '%'
LIMIT 200`
  }
};

export const defaultQueryOrder = Object.keys(queryRegistry) as QueryId[];

export function getQuery(id: QueryId): QueryDefinition {
  return queryRegistry[id];
}

export function bindSql(definition: QueryDefinition, input: ParsedPr): string {
  return definition.sql
    .replaceAll(":owner", sqlString(input.owner))
    .replaceAll(":repo", sqlString(input.repo))
    .replaceAll(":pr_number", String(input.prNumber));
}

export function sqlString(value: string): string {
  if (!/^[A-Za-z0-9_.-]+$/.test(value)) {
    throw new Error("Unsafe SQL string parameter.");
  }
  return `'${value.replaceAll("'", "''")}'`;
}
