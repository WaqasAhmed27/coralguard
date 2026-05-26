import { CheckCircle2, CircleAlert, CircleSlash, PlugZap } from "lucide-react";
import type { SourceHealth } from "@coralguard/core";

export function SourceHealthPanel({ sources }: { sources: SourceHealth[] }) {
  return (
    <div className="source-panel">
      <div className="section-title compact">
        <h2>Source Health</h2>
        <span>{sources.length} sources</span>
      </div>
      <div className="source-grid">
        {sources.map((source) => (
          <div className="source-row" key={source.name}>
            {iconFor(source.status)}
            <div>
              <strong>{source.name}</strong>
              <span>{source.status.replaceAll("_", " ")} / {source.mode}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function iconFor(status: SourceHealth["status"]) {
  if (status === "connected") return <CheckCircle2 className="ok" size={18} />;
  if (status === "optional_skipped") return <CircleSlash className="warn" size={18} />;
  if (status === "not_installed") return <PlugZap className="warn" size={18} />;
  return <CircleAlert className="bad" size={18} />;
}
