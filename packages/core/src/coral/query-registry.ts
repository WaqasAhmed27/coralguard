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
  liveSources?: string[];
  liveSql?: string;
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
LIMIT 1`,
    liveSql: `
SELECT
  owner,
  repo,
  number AS pr_number,
  title,
  body,
  user__login AS author,
  head__sha AS head_sha,
  base__ref AS base_branch,
  created_at,
  updated_at
FROM github.pulls
WHERE owner = :owner AND repo = :repo AND number = :pr_number
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
LIMIT 200`,
    liveSql: `
SELECT
  owner,
  repo,
  pull_number AS pr_number,
  filename AS file_path,
  additions,
  deletions,
  CASE
    WHEN filename LIKE '%payment%' OR filename LIKE '%billing%' THEN 'payments'
    WHEN filename LIKE '%checkout%' THEN 'checkout'
    WHEN filename LIKE '%auth%' THEN 'auth'
    WHEN filename LIKE 'docs/%' OR filename LIKE 'README%' THEN 'docs'
    ELSE split_part(filename, '/', 1)
  END AS service,
  NULL AS route,
  CASE
    WHEN filename LIKE 'packages/payments/package.json' THEN 'payment-retry'
    WHEN filename LIKE '%package.json' THEN 'unknown-package'
    ELSE NULL
  END AS dependency_name,
  CASE
    WHEN filename LIKE '%payment%' OR filename LIKE '%checkout%' OR filename LIKE '%auth%' OR filename LIKE '%deploy%' THEN 'critical'
    WHEN filename LIKE '%package.json' THEN 'high'
    ELSE 'low'
  END AS criticality
FROM github.files
WHERE owner = :owner AND repo = :repo AND pull_number = :pr_number
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
LIMIT 50`,
    liveSql: `
WITH changed AS (
  SELECT filename AS file_path
  FROM github.files
  WHERE owner = :owner AND repo = :repo AND pull_number = :pr_number
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
WHERE coverage.pr_number = :pr_number
LIMIT 50`,
    liveSql: `
WITH changed AS (
  SELECT filename AS file_path
  FROM github.files
  WHERE owner = :owner AND repo = :repo AND pull_number = :pr_number
)
SELECT coverage.file_path, coverage.before_percent, coverage.after_percent, coverage.changed_at
FROM ci_artifacts.coverage_changes AS coverage
JOIN changed ON coverage.file_path = changed.file_path
WHERE coverage.pr_number = :pr_number
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
LIMIT 25`,
    liveSql: `
WITH services AS (
  SELECT DISTINCT
    CASE
      WHEN filename LIKE '%payment%' OR filename LIKE '%billing%' THEN 'payments'
      WHEN filename LIKE '%checkout%' THEN 'checkout'
      WHEN filename LIKE '%auth%' THEN 'auth'
      WHEN filename LIKE 'docs/%' OR filename LIKE 'README%' THEN 'docs'
      ELSE split_part(filename, '/', 1)
    END AS service
  FROM github.files
  WHERE owner = :owner AND repo = :repo AND pull_number = :pr_number
)
SELECT
  issues.id AS issue_id,
  issues.title,
  issues.project AS service,
  NULL AS route,
  issues.count AS event_count_7d,
  issues.last_seen AS last_seen_at,
  issues.level AS severity
FROM (
  SELECT id, title, project, count, last_seen, level
  FROM sentry.issues
  WHERE query IN ('payments', 'billing', 'checkout', 'auth')
  LIMIT 50
) AS issues
JOIN services
  ON lower(issues.project) LIKE '%' || lower(services.service) || '%'
  OR lower(issues.title) LIKE '%' || lower(services.service) || '%'
WHERE issues.count > 0
ORDER BY issues.count DESC
LIMIT 25`
  },
  "risk.related_incidents_by_file": {
    id: "risk.related_incidents_by_file",
    label: "Historical incidents related to changed files",
    sources: ["github", "slack_incidents"],
    liveSources: ["github", "slack", "slack_incidents"],
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
LIMIT 25`,
    liveSql: `
WITH changed AS (
  SELECT
    filename AS file_path,
    CASE
      WHEN filename LIKE '%payment%' OR filename LIKE '%billing%' THEN 'payments'
      WHEN filename LIKE '%checkout%' THEN 'checkout'
      WHEN filename LIKE '%auth%' THEN 'auth'
      WHEN filename LIKE 'docs/%' OR filename LIKE 'README%' THEN 'docs'
      ELSE split_part(filename, '/', 1)
    END AS service
  FROM github.files
  WHERE owner = :owner AND repo = :repo AND pull_number = :pr_number
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
    liveSources: ["github", "linear"],
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
LIMIT 10`,
    liveSql: `
WITH services AS (
  SELECT DISTINCT
    CASE
      WHEN filename LIKE '%payment%' OR filename LIKE '%billing%' THEN 'payments'
      WHEN filename LIKE '%checkout%' THEN 'checkout'
      WHEN filename LIKE '%auth%' THEN 'auth'
      WHEN filename LIKE 'docs/%' OR filename LIKE 'README%' THEN 'docs'
      ELSE split_part(filename, '/', 1)
    END AS service
  FROM github.files
  WHERE owner = :owner AND repo = :repo AND pull_number = :pr_number
)
SELECT
  issues.identifier AS cluster_id,
  services.service,
  issues.team_key AS queue,
  'linear' AS customer_segment,
  CASE WHEN issues.priority > 0 THEN issues.priority ELSE 1 END AS ticket_count_7d,
  issues.title AS summary,
  issues.updated_at AS latest_ticket_at
FROM linear.issues AS issues
JOIN services
  ON lower(issues.title) LIKE '%' || lower(services.service) || '%'
  OR lower(coalesce(issues.description, '')) LIKE '%' || lower(services.service) || '%'
  OR lower(coalesce(issues.label_names, '')) LIKE '%' || lower(services.service) || '%'
WHERE issues.state_type <> 'completed'
ORDER BY issues.updated_at DESC
LIMIT 10`
  },
  "risk.flag_exposure_by_service": {
    id: "risk.flag_exposure_by_service",
    label: "Feature flag rollout exposure",
    sources: ["github", "flags"],
    liveSources: ["github", "launchdarkly"],
    sql: `
WITH services AS (
  SELECT DISTINCT service
  FROM github.pull_request_files
  WHERE owner = :owner AND repo = :repo AND pr_number = :pr_number
)
SELECT flag_key, service, rollout_percent, segment, updated_at
FROM flags.rollouts
JOIN services USING (service)
LIMIT 25`,
    liveSql: `
WITH services AS (
  SELECT DISTINCT
    CASE
      WHEN filename LIKE '%payment%' OR filename LIKE '%billing%' THEN 'payments'
      WHEN filename LIKE '%checkout%' THEN 'checkout'
      WHEN filename LIKE '%auth%' THEN 'auth'
      WHEN filename LIKE 'docs/%' OR filename LIKE 'README%' THEN 'docs'
      ELSE split_part(filename, '/', 1)
    END AS service
  FROM github.files
  WHERE owner = :owner AND repo = :repo AND pull_number = :pr_number
)
SELECT
  env.flag_key,
  services.service,
  CASE WHEN env.enabled THEN 100 ELSE 0 END AS rollout_percent,
  env.environment_key AS segment,
  env.last_modified AS updated_at
FROM launchdarkly.flag_environments AS env
JOIN services
  ON lower(env.flag_key) LIKE '%' || lower(services.service) || '%'
  OR lower(coalesce(env.name, '')) LIKE '%' || lower(services.service) || '%'
  OR lower(coalesce(env.tags, '')) LIKE '%' || lower(services.service) || '%'
WHERE env.project_key = 'default' AND env.environment_key = 'production'
LIMIT 25`
  },
  "risk.vulnerabilities_by_dependency": {
    id: "risk.vulnerabilities_by_dependency",
    label: "Dependency vulnerabilities introduced by PR",
    sources: ["github", "ci_artifacts", "osv"],
    liveSources: ["github", "ci_artifacts", "osv"],
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
LIMIT 200`,
    liveSql: `
WITH changed AS (
  SELECT
    filename AS file_path,
    CASE
      WHEN filename LIKE '%payment%' OR filename LIKE '%billing%' THEN 'payments'
      WHEN filename LIKE '%checkout%' THEN 'checkout'
      WHEN filename LIKE '%auth%' THEN 'auth'
      WHEN filename LIKE 'docs/%' OR filename LIKE 'README%' THEN 'docs'
      ELSE split_part(filename, '/', 1)
    END AS service
  FROM github.files
  WHERE owner = :owner AND repo = :repo AND pull_number = :pr_number
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

export type QueryProfile = "demo" | "live";

export function sourcesForProfile(definition: QueryDefinition, profile: QueryProfile = "demo"): string[] {
  return profile === "live" && definition.liveSources ? definition.liveSources : definition.sources;
}

export function bindSql(definition: QueryDefinition, input: ParsedPr, profile: QueryProfile = "demo"): string {
  const sql = profile === "live" && definition.liveSql ? definition.liveSql : definition.sql;
  return sql
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
