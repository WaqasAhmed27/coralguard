import type { ParsedPr } from "../schemas/input.js";
import type { QuerySummary } from "../schemas/report.js";
import type { CoralClient, QueryRow } from "./coral-client.js";
import { defaultQueryOrder, getQuery, sourcesForProfile, type QueryId, type QueryProfile } from "./query-registry.js";

export type QueryResult = {
  queryId: QueryId;
  rows: QueryRow[];
};

export async function runAssessmentQueries(
  client: CoralClient,
  input: ParsedPr,
  queryIds: QueryId[] = defaultQueryOrder,
  profile: QueryProfile = "demo"
): Promise<{ results: QueryResult[]; summaries: QuerySummary[]; warnings: string[] }> {
  const results: QueryResult[] = [];
  const summaries: QuerySummary[] = [];
  const warnings: string[] = [];

  for (const queryId of queryIds) {
    const definition = getQuery(queryId);
    const sourceNames = sourcesForProfile(definition, profile);
    try {
      const rows = await client.runQuery(queryId, input);
      results.push({ queryId, rows });
      summaries.push({
        id: queryId,
        label: definition.label,
        sql: definition.sql.trim(),
        rowCount: rows.length,
        sourceNames
      });
    } catch (error) {
      warnings.push(`${definition.label} failed: ${String(error instanceof Error ? error.message : error)}`);
      results.push({ queryId, rows: [] });
      summaries.push({
        id: queryId,
        label: definition.label,
        sql: definition.sql.trim(),
        rowCount: 0,
        sourceNames
      });
    }
  }

  return { results, summaries, warnings };
}
