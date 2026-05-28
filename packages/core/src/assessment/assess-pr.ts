import { DemoCoralClient, CoralCliClient, type CoralClient } from "../coral/coral-client.js";
import { runAssessmentQueries } from "../coral/query-runner.js";
import { getSourceHealth } from "../coral/source-health.js";
import { parsePullRequestInput, prInputSchema, type PrInput } from "../schemas/input.js";
import { assessmentReportSchema, type AssessmentReport, type QuerySummary, type SourceHealth } from "../schemas/report.js";
import { normalizeEvidence } from "./evidence-normalizer.js";
import { calculateRiskScore } from "./risk-score.js";
import { buildBlastRadius } from "./blast-radius.js";
import { buildTestPlan } from "./test-plan.js";
import { buildRollbackPlan } from "./rollback-plan.js";
import { buildPrCommentMarkdown, recommendationFor } from "./pr-comment.js";

export type AssessOptions = {
  client?: CoralClient;
  now?: Date;
};

export async function assessPullRequest(rawInput: PrInput, options: AssessOptions = {}): Promise<AssessmentReport> {
  const inputConfig = prInputSchema.parse(rawInput);
  const input = parsePullRequestInput(inputConfig);
  const sourceHealth = await getSourceHealth(inputConfig.mode, inputConfig.missingSources);
  const client = options.client ?? (inputConfig.mode === "demo" ? new DemoCoralClient() : new CoralCliClient());
  const skippedSources = new Set(inputConfig.missingSources);
  const queryProfile = inputConfig.mode === "live" ? "live" : "demo";
  const { results, summaries, warnings } = await runAssessmentQueries(client, input, undefined, queryProfile);
  const filteredResults = results.map((result) => {
    const summary = summaries.find((item) => item.id === result.queryId);
    return summary?.sourceNames.some((source) => skippedSources.has(source)) ? { ...result, rows: [] } : result;
  });
  const effectiveSourceHealth = markFailingSources(sourceHealth, summaries, warnings);
  const evidence = normalizeEvidence(filteredResults, inputConfig.redaction === "strict");
  const risk = calculateRiskScore(evidence, effectiveSourceHealth, options.now ?? new Date());
  const partial = {
    assessmentId: `assess_${input.owner}_${input.repo}_${input.prNumber}`,
    input,
    riskLevel: risk.level,
    riskScore: risk.score,
    confidence: risk.confidence,
    recommendation: recommendationFor(risk.level),
    evidence,
    blastRadius: buildBlastRadius(evidence),
    testPlan: buildTestPlan(evidence),
    rollbackPlan: buildRollbackPlan(input, evidence),
    sourceHealth: effectiveSourceHealth,
    querySummaries: summaries,
    warnings,
    generatedAt: (options.now ?? new Date()).toISOString()
  };
  return assessmentReportSchema.parse({
    ...partial,
    prCommentMarkdown: buildPrCommentMarkdown(partial)
  });
}

function markFailingSources(sourceHealth: SourceHealth[], summaries: QuerySummary[], warnings: string[]): SourceHealth[] {
  if (warnings.length === 0) return sourceHealth;

  const failedSources = new Set<string>();
  for (const summary of summaries) {
    const failed = warnings.some((warning) => warning.startsWith(`${summary.label} failed:`));
    if (failed) {
      summary.sourceNames.forEach((sourceName) => failedSources.add(sourceName));
    }
  }

  if (failedSources.size === 0) return sourceHealth;

  return sourceHealth.map((source) =>
    failedSources.has(source.name)
      ? {
          ...source,
          status: "failing",
          message: "One or more Coral queries for this source failed; treat the report as degraded."
        }
      : source
  );
}
