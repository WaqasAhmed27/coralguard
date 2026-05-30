import { Check, CircleAlert, CircleSlash, PlugZap } from "lucide-react";
import type { SourceHealth } from "@coralguard/core";

export function SourceHealthPanel({
  activeCount,
  searchTerm,
  sources
}: {
  activeCount?: number;
  searchTerm?: string;
  sources: SourceHealth[];
}) {
  const filtered = filterSources(sources, searchTerm);

  return (
    <section className="source-panel" id="sources">
      <div className="section-bar inverse">
        <h2>Source Health</h2>
        <span>{activeCount ?? sources.length} nodes active</span>
      </div>
      <div className="source-grid">
        {filtered.map((source) => (
          <article className={`source-node source-${source.status}`} key={source.name}>
            <div>
              {iconFor(source.status)}
              <strong>{source.name}</strong>
            </div>
            <span>{source.status.replaceAll("_", " ")} / {source.mode}</span>
          </article>
        ))}
        {!filtered.length ? <p className="empty-inline">No sources match the current search.</p> : null}
      </div>
    </section>
  );
}

function filterSources(sources: SourceHealth[], searchTerm = "") {
  const needle = searchTerm.trim().toLowerCase();
  if (!needle) return sources;
  return sources.filter((source) =>
    [source.name, source.status, source.mode, source.message].some((value) => value.toLowerCase().includes(needle))
  );
}

function iconFor(status: SourceHealth["status"]) {
  if (status === "connected") return <Check size={15} />;
  if (status === "optional_skipped") return <CircleSlash size={15} />;
  if (status === "not_installed") return <PlugZap size={15} />;
  return <CircleAlert size={15} />;
}
