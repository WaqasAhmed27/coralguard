import { ChevronDown, Database } from "lucide-react";
import type { QuerySummary } from "@coralguard/core";

export function QueryInspector({ queries, searchTerm = "" }: { queries: QuerySummary[]; searchTerm?: string }) {
  const filtered = filterQueries(queries, searchTerm);

  return (
    <section className="query-inspector" id="queries">
      <div className="terminal-title">
        <h2>
          <Database size={16} />
          Coral SQL Query Inspector
        </h2>
        <div className="terminal-lights" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
      <div className="query-list">
        {filtered.map((query) => (
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
        {!filtered.length ? <p className="empty-inline inverse-text">No Coral SQL queries match the current search.</p> : null}
      </div>
    </section>
  );
}

function filterQueries(queries: QuerySummary[], searchTerm: string) {
  const needle = searchTerm.trim().toLowerCase();
  if (!needle) return queries;
  return queries.filter((query) =>
    [query.id, query.label, query.sql, query.sourceNames.join(" ")].some((value) => value.toLowerCase().includes(needle))
  );
}
