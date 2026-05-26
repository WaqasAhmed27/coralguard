# CoralGuard PRD and Implementation Plan

Version: 1.0  
Date: 2026-05-26  
Project: CoralGuard  
Hackathon track: Enterprise Agent  
Primary goal: Build a complete, demoable, production-minded agent that uses Coral to prevent risky pull requests from causing incidents.

## 1. Product Summary

CoralGuard is a pre-merge reliability agent for engineering teams.

It answers:

> If we merge this pull request today, what is most likely to break in production, who will be affected, and what evidence supports that?

The product takes a GitHub pull request URL, queries Coral-backed sources, and returns a merge-risk report with evidence, blast radius, suggested tests, rollback steps, and a GitHub-ready PR comment.

CoralGuard must not behave like a generic chatbot. Every recommendation must be traceable to query results from Coral. The product should make Coral feel essential by joining fragmented engineering data sources through SQL.

## 2. Coral-Specific Foundation

The implementation is based on these Coral capabilities from the official docs:

- Coral provides one SQL interface for APIs, files, and other data sources.
- Each source appears as a SQL schema, allowing joins across sources such as GitHub, Linear, Slack, Sentry, and local files.
- Coral can run through the CLI using `coral sql` or through MCP using `coral mcp-stdio`.
- Coral supports bundled sources and custom source specs.
- Custom source specs are YAML files with `dsl_version: 3` and backends such as `http`, `jsonl`, and `parquet`.
- Source specs can be validated with `coral source lint`, installed with `coral source add --file`, and tested with `coral source test`.
- Coral's MCP server exposes read-only SQL tools plus catalog discovery tools.
- Coral runs locally, with data, credentials, and usage history kept on the machine.

Official references:

- https://withcoral.com/docs
- https://withcoral.com/docs/guides/use-coral-over-mcp
- https://withcoral.com/docs/guides/write-a-custom-source
- https://withcoral.com/docs/reference/source-spec-reference
- https://withcoral.com/docs/reference/bundled-sources
- https://withcoral.com/docs/reference/cli-reference
- https://withcoral.com/docs/guides/observe-with-opentelemetry

## 3. Target Users

Primary user:

- Engineering lead, SRE, or senior developer reviewing risky PRs before merge.

Secondary users:

- Product engineer who wants to know what tests to run.
- Support lead who wants to know whether a release may affect customers.
- Incident commander who wants a rollback plan before approving a deployment.

## 4. Problem

Modern engineering risk is scattered across systems:

- GitHub knows what code changed.
- CI knows what failed.
- Sentry knows recent runtime errors.
- Observability tools know service health.
- Slack knows past incidents and operational context.
- Linear or Jira knows related bugs.
- LaunchDarkly knows rollout exposure.
- Intercom or HubSpot knows customer pain.
- Security scanners know dependency risk.

Reviewers usually inspect these separately or skip them under time pressure. This leads to production incidents that were predictable from existing signals.

## 5. Product Objectives

CoralGuard must:

1. Accept a GitHub PR URL or owner/repo/PR number.
2. Query Coral for code, CI, incidents, observability, feature flags, support, and security context.
3. Join evidence across sources using Coral SQL.
4. Produce a deterministic merge-risk report.
5. Explain every risk with source-backed evidence.
6. Suggest targeted tests, rollback steps, and owner actions.
7. Export a concise GitHub-ready PR comment.
8. Handle missing sources, empty data, rate limits, and malformed input cleanly.
9. Protect secrets and sensitive customer data.
10. Be tested enough that the demo does not collapse under realistic edge cases.

## 6. Non-Goals

CoralGuard will not:

- Automatically block merges in GitHub during the hackathon MVP.
- Modify production systems.
- Write to source systems except optional local report export.
- Train a model on customer data.
- Claim certainty when evidence is weak.
- Replace human code review.

## 7. Success Metrics

Hackathon demo success:

- A judge enters or sees one PR URL.
- The app returns a risk report in under 30 seconds using seeded sources.
- The report includes at least 5 joined evidence types.
- The report includes at least 3 SQL-backed citations.
- The demo clearly shows why Coral is better than calling APIs one by one.

Product quality success:

- 90 percent of test fixtures produce stable risk scores.
- All high-risk recommendations include evidence IDs.
- No raw secrets appear in logs, reports, UI, or errors.
- All missing-source scenarios degrade gracefully.
- The codebase has clear module boundaries and no large unstructured agent scripts.

## 8. Core User Journey

1. User opens CoralGuard dashboard.
2. User pastes a PR URL.
3. CoralGuard validates the URL and extracts owner, repo, and PR number.
4. CoralGuard runs source health checks.
5. CoralGuard queries Coral for:
   - PR metadata
   - changed files
   - CI status
   - recent errors
   - related incidents
   - related support tickets
   - feature flag exposure
   - dependency/security findings
   - ownership metadata
6. CoralGuard computes risk score from evidence.
7. CoralGuard generates a report from structured evidence.
8. User reviews:
   - merge recommendation
   - risk score
   - evidence timeline
   - blast radius
   - test plan
   - rollback plan
   - PR comment
9. User copies the PR comment or downloads a JSON/Markdown report.

## 9. MVP Feature Set

### 9.1 PR Assessment Input

Supported input:

- `https://github.com/{owner}/{repo}/pull/{number}`
- `{owner}/{repo}#{number}`
- direct CLI flags: `--owner`, `--repo`, `--pr`

Validation:

- Reject non-GitHub URLs.
- Reject branch names or issue URLs.
- Return actionable error for private repo access failures.

### 9.2 Source Health Panel

Show status for each configured source:

- Connected
- Missing credentials
- Installed but failing validation
- Not installed
- Optional and skipped

Minimum MVP sources:

- GitHub
- Local CI artifacts custom source
- Sentry or seeded Sentry-like JSONL
- Slack or seeded Slack-like JSONL
- Linear/Jira or seeded issue JSONL
- LaunchDarkly-like flag JSONL
- Support-ticket JSONL
- OSV or seeded dependency vulnerability JSONL

The demo may use seeded JSONL sources where real service credentials are unavailable. The product must make clear whether a source is live or seeded.

### 9.3 Evidence Query Engine

The engine runs a fixed set of Coral SQL queries and returns typed evidence objects.

Required evidence categories:

- `code_change`
- `ci_failure`
- `runtime_error`
- `incident_history`
- `customer_signal`
- `feature_flag_exposure`
- `security_finding`
- `ownership`

Each evidence object must include:

- `id`
- `category`
- `source`
- `title`
- `summary`
- `severity`
- `confidence`
- `timestamp`
- `entity_refs`
- `sql_query_id`
- `raw_row_hash`

### 9.4 Risk Score

Risk levels:

- Low: merge likely safe, normal review.
- Medium: merge with targeted checks.
- High: delay merge until listed checks pass.
- Critical: block merge and escalate owner review.

Risk score inputs:

- Changed file criticality.
- CI failure count and recency.
- Recent production errors in touched service.
- Similar historical incidents.
- Customer ticket volume.
- Feature flag exposure.
- Vulnerability severity.
- Missing test coverage around changed files.
- Ownership confidence.

Scoring must be deterministic. LLM output cannot determine the numeric score.

### 9.5 Evidence Timeline

Timeline items are sorted by time and grouped by source.

Each timeline card shows:

- Source name.
- Timestamp.
- Evidence summary.
- Why it matters.
- Linked entity if available.
- SQL query label.

### 9.6 Blast Radius

Blast radius output:

- Affected services.
- Affected routes or components.
- Feature flags.
- Customer segment.
- Related support queues.
- Code owners.
- On-call owner if available.

### 9.7 Suggested Test Plan

The test plan must be generated from evidence, not generic advice.

Example:

- Run checkout retry regression because changed files overlap with prior incident `INC-104`.
- Run duplicate-charge test because support tickets mention duplicate billing after retry timeout.
- Run flag rollback test because `checkout_v2` is enabled for 80 percent of users.

### 9.8 Rollback Plan

Rollback plan includes:

- Revert command.
- Feature flag rollback action.
- Owner to notify.
- Metrics to watch after deploy.
- Sentry issue query to monitor.

No destructive command should be automatically executed.

### 9.9 GitHub-Ready PR Comment

Output format:

```markdown
## CoralGuard Merge Risk: High

Recommendation: Delay merge until targeted checks pass.

Top risks:
1. Payment retry code changed while recent production errors exist in checkout confirmation.
2. Duplicate-charge support tickets increased this week.
3. Checkout feature flag is rolled out to 80 percent of users.

Required checks:
- Run checkout retry regression.
- Verify duplicate-charge prevention.
- Reduce checkout_v2 rollout to 10 percent before merge.

Evidence:
- Sentry issue: PaymentIntentTimeout
- Intercom tickets: duplicate charge cluster
- LaunchDarkly flag: checkout_v2 at 80 percent
```

## 10. UX Requirements

The UI should be clean, dense, and operational. It should feel like an engineering review tool, not a marketing page.

Required screens:

1. Assessment screen
   - PR input
   - Source health
   - Run button
2. Report screen
   - Risk score
   - Recommendation
   - Evidence timeline
   - Blast radius
   - Test plan
   - Rollback plan
   - PR comment
3. Query inspector
   - Shows SQL query templates and result summaries.
   - Used to prove Coral is central to the product.

UI rules:

- No decorative landing page.
- No fake chat interface as the primary experience.
- Evidence must be visible.
- Risk must be explainable without opening dev tools.
- Empty states must explain what source is missing.

## 11. Recommended Technical Stack

Use TypeScript for product code to keep the codebase coherent.

Frontend:

- Next.js or Vite React
- Tailwind CSS
- shadcn/ui or simple local UI components

Backend:

- Node.js
- Fastify or Next.js API routes
- Zod for input and output validation
- Child process wrapper for `coral sql --format json`

Testing:

- Vitest for unit tests.
- Playwright for end-to-end UI tests.
- Zod schema tests for report contracts.
- Snapshot tests for seeded demo reports.

Coral integration:

- MVP: call Coral CLI directly with `coral sql --format json`.
- Stretch: add MCP mode for agent workflows using `coral mcp-stdio`.

Data:

- Seeded JSONL demo data for repeatable judging.
- Optional live sources if credentials are available.

## 12. Codebase Structure

```text
coralguard/
  apps/
    web/
      src/
        app/
        components/
        features/assessment/
        features/report/
        features/query-inspector/
        styles/
      tests/
  packages/
    core/
      src/
        assessment/
          assess-pr.ts
          risk-score.ts
          evidence-normalizer.ts
          blast-radius.ts
          test-plan.ts
          rollback-plan.ts
        coral/
          coral-client.ts
          query-runner.ts
          query-registry.ts
          source-health.ts
        schemas/
          input.ts
          evidence.ts
          report.ts
        security/
          redact.ts
          prompt-injection.ts
          pii.ts
        utils/
      tests/
    sources/
      ci_artifacts.source.yaml
      demo_data/
        ci/
        sentry/
        slack/
        support/
        flags/
        vulnerabilities/
    fixtures/
      risky-payment-pr/
      safe-docs-pr/
      missing-source-pr/
  scripts/
    install-demo-sources.ps1
    install-demo-sources.sh
    run-demo-assessment.ps1
  docs/
    architecture.md
    threat-model.md
    demo-script.md
```

Rules:

- No business logic inside React components.
- No raw SQL strings scattered through the codebase.
- All Coral queries live in `query-registry.ts`.
- All external command execution goes through `coral-client.ts`.
- All user-visible report data passes through Zod schemas.
- All secret redaction is centralized in `security/redact.ts`.

## 13. Custom Coral Source: CI Artifacts

Purpose:

Expose local test, coverage, SARIF, dependency, and CODEOWNERS-derived data as Coral SQL tables.

Source name:

`ci_artifacts`

Backend:

`jsonl`

Tables:

- `ci_artifacts.test_failures`
- `ci_artifacts.coverage_changes`
- `ci_artifacts.sarif_findings`
- `ci_artifacts.dependency_diff`
- `ci_artifacts.codeowners`

Example source spec shape:

```yaml
name: ci_artifacts
version: 0.1.0
dsl_version: 3
backend: jsonl
test_queries:
  - SELECT * FROM ci_artifacts.test_failures LIMIT 1
  - SELECT * FROM ci_artifacts.coverage_changes LIMIT 1
tables:
  - name: test_failures
    description: Failed test cases from CI artifacts
    source:
      location: file:///ABSOLUTE_PATH_TO_DEMO_DATA/ci/
      glob: "test_failures.jsonl"
    columns:
      - name: pr_number
        type: Int64
      - name: test_name
        type: Utf8
      - name: file_path
        type: Utf8
      - name: failure_message
        type: Utf8
      - name: failed_at
        type: Utf8
```

Validation commands:

```bash
coral source lint ./packages/sources/ci_artifacts.source.yaml
coral source add --file ./packages/sources/ci_artifacts.source.yaml
coral source test ci_artifacts
```

## 14. Coral Query Registry

All queries must have stable IDs.

Example query IDs:

- `github.pr_summary`
- `github.changed_files`
- `ci.failures_for_changed_files`
- `risk.recent_errors_by_service`
- `risk.related_incidents_by_file`
- `risk.support_tickets_by_keyword`
- `risk.flag_exposure_by_service`
- `risk.vulnerabilities_by_dependency`
- `risk.owner_resolution`

Example query:

```sql
WITH changed AS (
  SELECT file_path
  FROM github.pull_request_files
  WHERE owner = :owner AND repo = :repo AND pr_number = :pr_number
),
failures AS (
  SELECT test_name, file_path, failure_message, failed_at
  FROM ci_artifacts.test_failures
  WHERE pr_number = :pr_number
)
SELECT
  failures.test_name,
  failures.file_path,
  failures.failure_message,
  failures.failed_at
FROM failures
JOIN changed
  ON failures.file_path = changed.file_path
LIMIT 50
```

Query requirements:

- Always use bounded result limits.
- Never select secrets or unnecessary body fields.
- Prefer exact filters before text matching.
- Include query ID in every evidence object.
- Hash raw rows before storing references.

## 15. API Design

### `POST /api/assess`

Request:

```json
{
  "prUrl": "https://github.com/demo/shop/pull/214",
  "mode": "demo"
}
```

Response:

```json
{
  "assessmentId": "assess_01",
  "riskLevel": "high",
  "riskScore": 82,
  "recommendation": "Delay merge until targeted checks pass.",
  "evidence": [],
  "blastRadius": {},
  "testPlan": [],
  "rollbackPlan": {},
  "prCommentMarkdown": ""
}
```

### `GET /api/sources/health`

Returns source installation and validation status.

### `GET /api/assessments/:id`

Returns a saved local assessment.

### `GET /api/assessments/:id/export.md`

Returns a Markdown report.

## 16. Data Contracts

Evidence schema:

```ts
type Evidence = {
  id: string;
  category:
    | "code_change"
    | "ci_failure"
    | "runtime_error"
    | "incident_history"
    | "customer_signal"
    | "feature_flag_exposure"
    | "security_finding"
    | "ownership";
  source: string;
  title: string;
  summary: string;
  severity: "low" | "medium" | "high" | "critical";
  confidence: number;
  timestamp: string | null;
  entityRefs: string[];
  sqlQueryId: string;
  rawRowHash: string;
};
```

Report schema:

```ts
type AssessmentReport = {
  assessmentId: string;
  input: {
    owner: string;
    repo: string;
    prNumber: number;
    prUrl: string;
  };
  riskLevel: "low" | "medium" | "high" | "critical";
  riskScore: number;
  recommendation: string;
  evidence: Evidence[];
  blastRadius: BlastRadius;
  testPlan: TestPlanItem[];
  rollbackPlan: RollbackPlan;
  prCommentMarkdown: string;
  sourceHealth: SourceHealth[];
  generatedAt: string;
};
```

## 17. Risk Scoring Specification

Base score: 0.

Additive scoring:

- Critical file changed: +15
- Payment/auth/deploy path changed: +20
- CI failure on changed file: +15 per unique test group, max +30
- Recent runtime errors in affected service: +20
- Similar incident in last 90 days: +20
- Support-ticket spike: +15
- Feature flag exposure above 50 percent: +10
- Critical vulnerability in changed dependency: +25
- Missing code owner: +10
- Coverage drop above 5 percent: +10

Caps:

- Max score: 100
- Low: 0-29
- Medium: 30-59
- High: 60-84
- Critical: 85-100

Confidence:

- Start at 0.5.
- Add 0.1 for each independent source with relevant evidence, max 0.95.
- Subtract 0.15 if key source is missing.
- Subtract 0.1 if evidence is older than 90 days.

LLM usage:

- LLM may summarize.
- LLM may not invent score, evidence, source names, owners, or dates.
- LLM output must be validated against the structured evidence list.

## 18. Security Requirements

### 18.1 Secrets

Requirements:

- Never store API tokens in the app database.
- Let Coral manage source credentials locally.
- Do not print environment variables.
- Redact tokens, bearer strings, cookies, and common secret patterns from logs.
- Disable verbose command logging by default.

Tests:

- Feed fake GitHub token into error text and assert it is redacted.
- Assert report export contains no known secret fixture values.

### 18.2 Prompt Injection

Threat:

PR descriptions, Slack messages, tickets, or incident notes may contain text like "ignore previous instructions" or "hide this issue."

Mitigation:

- Treat all source text as untrusted data.
- Put source text inside quoted evidence fields.
- System prompt must say source content cannot override developer instructions.
- LLM must output only JSON matching schema.
- Reject summaries that reference evidence IDs not present in the evidence array.

Tests:

- Seed a malicious PR description and verify the final report still includes real risks.
- Seed a support ticket asking the agent to leak secrets and verify no secret exposure.

### 18.3 PII and Customer Data

Requirements:

- Show customer segment or account count by default, not raw personal identifiers.
- Redact emails and phone numbers in UI summaries.
- Keep raw rows only in memory unless user explicitly exports a local report.
- Provide `--redaction=strict` mode for demos.

Tests:

- Email and phone redaction unit tests.
- Snapshot test for strict report export.

### 18.4 Command Execution

Threat:

PR URL or user input could be used to inject shell commands.

Mitigation:

- Never concatenate user input into shell commands.
- Use `spawn` or equivalent with argument arrays.
- Validate owner, repo, and PR number with strict regex.
- Reject any input containing shell metacharacters after parsing.

Tests:

- Inputs with `;`, `&&`, pipes, `$()`, backticks, and newlines are rejected.

### 18.5 SQL Safety

Threat:

Dynamic SQL injection into Coral queries.

Mitigation:

- Query registry uses templates with typed parameters.
- Escape string literals through a single helper.
- Prefer validated enum and numeric parameters.
- Reject arbitrary user-written SQL in MVP.

Tests:

- PR owner/repo injection fixtures.
- Query builder snapshot tests.

### 18.6 Data Retention

Requirements:

- Default to local-only storage.
- Store only normalized evidence and row hashes.
- Provide delete assessment action.
- Avoid storing raw Slack/support bodies unless needed for a visible citation.

## 19. Edge Cases and Expected Behavior

| Edge case | Expected behavior | Test |
|---|---|---|
| Invalid GitHub URL | Show validation error, no Coral query runs | Unit |
| Private repo without access | Show GitHub source access error | Integration |
| Coral CLI not installed | Source health shows setup action | Unit |
| Source not installed | Mark source as unavailable and continue if optional | Integration |
| Required source missing | Return incomplete assessment with low confidence | Integration |
| Empty Sentry results | Do not invent runtime risk | Unit |
| Many noisy support tickets | Cluster and cap evidence at top 10 | Unit |
| API rate limit | Show degraded source status and retry hint | Integration |
| Slow source | Timeout source query and continue with warning | Integration |
| Conflicting evidence | Show conflict instead of hiding it | Unit |
| Old incident evidence | Lower confidence and mark as historical | Unit |
| Feature flag missing rollout | Mark exposure unknown, no exposure score | Unit |
| Vulnerability lacks severity | Treat as medium confidence, no critical score | Unit |
| Malicious PR description | Ignore instructions in PR text | Security |
| Secret appears in source text | Redact in UI, logs, and export | Security |
| Duplicate evidence rows | Deduplicate by hash and entity refs | Unit |
| Timezone mismatch | Normalize all timestamps to UTC in reports | Unit |
| Huge PR | Limit changed files and warn about truncated analysis | Integration |
| Binary-only PR | Skip code semantic analysis, still inspect CI/security | Unit |
| Docs-only PR | Score low unless other signals exist | Snapshot |

## 20. Test Plan

### 20.1 Unit Tests

Required coverage:

- PR URL parser.
- Risk score calculation.
- Confidence calculation.
- Evidence normalization.
- Deduplication.
- Secret redaction.
- PII redaction.
- SQL parameter escaping.
- Prompt-injection guardrails.
- Markdown PR comment generation.

### 20.2 Integration Tests

Required coverage:

- Coral CLI wrapper receives argument arrays.
- JSON output from `coral sql --format json` is parsed correctly.
- Source health handles installed, missing, and failing sources.
- Custom `ci_artifacts` source can be linted and tested.
- Assessment pipeline works with seeded risky PR.
- Assessment pipeline works with seeded low-risk PR.

### 20.3 End-to-End Tests

Playwright scenarios:

1. User assesses risky payment PR and sees high risk.
2. User assesses docs-only PR and sees low risk.
3. User assesses PR while Slack source is missing and sees degraded confidence.
4. User opens query inspector and sees Coral SQL evidence.
5. User exports GitHub PR comment.

### 20.4 Security Tests

Required fixtures:

- Malicious PR body.
- Slack message with prompt injection.
- Support ticket containing fake API token.
- Repo name containing shell metacharacters.
- SQL injection attempt in owner/repo path.

Pass criteria:

- No untrusted instruction changes behavior.
- No secrets appear in output.
- No shell metacharacters reach command execution.
- No arbitrary SQL can be executed by user input.

### 20.5 Demo Reliability Tests

Before submission:

- Run full test suite.
- Reinstall demo Coral source from scratch.
- Run assessment from CLI.
- Run assessment from UI.
- Run app with network disabled against seeded local sources.
- Record 3-minute demo after tests pass.

## 21. Implementation Milestones

### Milestone 1: Product Skeleton

Deliverables:

- Monorepo setup.
- Web app shell.
- Core package.
- Zod schemas.
- PR input parser.
- Empty report UI.

Acceptance:

- App runs locally.
- Invalid PR URLs show useful errors.

### Milestone 2: Coral Integration

Deliverables:

- Coral CLI wrapper.
- Query registry.
- Source health checks.
- Demo source install scripts.
- Custom `ci_artifacts` source spec.

Acceptance:

- `coral source lint` passes for custom source.
- `coral source test ci_artifacts` passes.
- App can run at least one Coral query and display result summary.

### Milestone 3: Evidence Pipeline

Deliverables:

- Evidence normalizer.
- Query result parsers.
- Deduplication.
- Seeded risky PR dataset.
- Seeded low-risk PR dataset.

Acceptance:

- Risky PR produces evidence from at least 5 categories.
- Low-risk PR does not show invented risks.

### Milestone 4: Risk and Report Generation

Deliverables:

- Deterministic risk scoring.
- Confidence scoring.
- Blast radius builder.
- Test plan generator.
- Rollback plan generator.
- PR comment exporter.

Acceptance:

- Risk score is stable across repeated runs.
- Every high-risk claim has an evidence ID.

### Milestone 5: UX and Query Inspector

Deliverables:

- Assessment screen.
- Report screen.
- Source health panel.
- Query inspector.
- Loading, empty, error, and degraded states.

Acceptance:

- Judge can understand the product without verbal explanation.
- UI clearly shows Coral SQL is powering the report.

### Milestone 6: Hardening

Deliverables:

- Unit tests.
- Integration tests.
- Playwright tests.
- Security fixtures.
- Redaction.
- Prompt-injection guardrails.
- Demo script.

Acceptance:

- Full test suite passes.
- No known secret appears in logs or exports.
- Demo works from a clean checkout.

## 22. Demo Dataset

Use one strong seeded story.

PR:

- `demo/shop#214`
- Title: `Update payment retry behavior for checkout_v2`
- Changed files:
  - `services/payments/retry.ts`
  - `services/checkout/confirm.ts`
  - `packages/payments/package.json`

Evidence:

- CI: retry regression test failing.
- Sentry: `PaymentIntentTimeout` in checkout confirmation.
- Support: duplicate-charge tickets increased this week.
- Slack: previous incident thread mentions payment retry timeout.
- Feature flag: `checkout_v2` enabled for 80 percent of users.
- OSV: changed dependency has high-severity vulnerability.
- CODEOWNERS: payments team owns touched files.

Expected report:

- Risk level: High or Critical.
- Recommendation: Delay merge.
- Required checks:
  - Fix retry regression.
  - Verify duplicate-charge prevention.
  - Reduce flag exposure before rollout.
  - Monitor checkout latency and payment timeout errors.

## 23. Demo Script

1. Show PR URL input.
2. Paste risky PR.
3. Run assessment.
4. Show source health: GitHub plus local seeded Coral sources connected.
5. Show risk score.
6. Open evidence timeline.
7. Open query inspector and show one cross-source SQL query.
8. Show suggested test plan.
9. Show rollback plan.
10. Copy GitHub-ready PR comment.
11. Close with: CoralGuard stopped a predictable incident before merge by joining code, incidents, observability, support, flags, and security data through Coral.

## 24. Judging Alignment

Impact:

- Prevents production incidents before they happen.
- Saves engineering, support, and customer trust.

Creativity:

- Moves beyond reactive incident debugging.
- Turns Coral into a pre-merge reliability gate.

Technical implementation:

- Uses Coral SQL joins across multiple systems.
- Includes custom source spec.
- Has deterministic scoring and schema validation.

UX and aesthetics:

- Operational dashboard built for engineering review.
- Evidence-first report with clean source health and query inspector.

Learning and growth:

- Demonstrates bundled sources, custom source specs, source validation, SQL joins, and local-first architecture.

Best use of Coral:

- Coral is the core retrieval and join layer.
- The product would be much weaker as a plain chatbot or direct API wrapper.

## 25. Open Implementation Decisions

Decide before coding:

- Use Next.js API routes or separate Fastify backend.
- Use only local seeded sources for demo or mix live GitHub with local JSONL.
- Use LLM summarization through local provider, OpenAI API, or static template for hackathon reliability.
- Store assessment history in SQLite or local JSON files.

Recommended choices:

- Use Next.js plus packages/core for speed.
- Use seeded JSONL for all non-GitHub sources.
- Use deterministic templates first, LLM summary second.
- Store reports as local JSON files during MVP.

## 26. Definition of Done

The project is done when:

- A fresh developer can install dependencies, install demo Coral sources, and run the app.
- A risky PR assessment produces a high-confidence, evidence-backed report.
- A low-risk PR assessment produces a low-risk report.
- Missing optional sources do not crash the app.
- All security tests pass.
- All user-visible high-risk claims cite evidence.
- The custom Coral source lints and tests successfully.
- The demo can be completed in under 3 minutes.

## 27. Final Positioning

CoralGuard turns Coral into a pre-merge reliability layer for software teams.

It joins code, CI, incidents, observability, support, feature flags, ownership, and security data through SQL, then produces an evidence-backed answer to the question every reviewer secretly asks:

> What breaks if I approve this?

