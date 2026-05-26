import { ChevronDown, Database } from "lucide-react";
import type { QuerySummary } from "@coralguard/core";

export function QueryInspector({ queries }: { queries: QuerySummary[] }) {
  return (
    <section className="query-inspector">
      <div className="section-title">
        <h2>Coral SQL Query Inspector</h2>
        <Database size={18} />
      </div>
      <div className="query-list">
        {queries.map((query) => (
          <details key={query.id}>
            <summary>
              <ChevronDown size={16} />
              <span>{query.id}</span>
              <code>{query.rowCount} rows</code>
              <em>{query.sourceNames.join(" + ")}</em>
            </summary>
            <pre>{query.sql}</pre>
          </details>
        ))}
      </div>
    </section>
  );
}
