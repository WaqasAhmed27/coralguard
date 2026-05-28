import { Activity, Clipboard, Database, GitPullRequest, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import type { AssessmentReport, SourceHealth } from "@coralguard/core";
import { SourceHealthPanel } from "./features/assessment/SourceHealthPanel.js";
import { ReportView } from "./features/report/ReportView.js";
import { QueryInspector } from "./features/query-inspector/QueryInspector.js";

export function App() {
  const [prUrl, setPrUrl] = useState("https://github.com/demo/shop/pull/214");
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [report, setReport] = useState<AssessmentReport | null>(null);
  const [sources, setSources] = useState<SourceHealth[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/sources/health?mode=${mode}`).then((response) => response.json()).then(setSources).catch(() => setSources([]));
  }, [mode]);

  async function runAssessment() {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const response = await fetch("/api/assess", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prUrl, mode, redaction: "strict" })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Assessment failed.");
      setReport(body);
      setSources(body.sourceHealth);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Assessment failed.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  async function copyComment() {
    if (!report) return;
    await navigator.clipboard.writeText(report.prCommentMarkdown);
    setCopied(true);
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="topbar">
          <div>
            <div className="brand-row">
              <ShieldAlert size={22} />
              <h1>CoralGuard</h1>
            </div>
            <p>Pre-merge incident prevention powered by Coral SQL evidence joins.</p>
          </div>
          <div className="status-pill">
            <Database size={16} />
            {mode === "live" ? "Live Coral sources" : "Demo Coral sources"}
          </div>
        </header>

        <section className="assessment-band">
          <div className="input-panel">
            <label htmlFor="pr-url">GitHub PR</label>
            <div className="mode-toggle" aria-label="Assessment mode">
              <button className={mode === "demo" ? "active" : ""} onClick={() => setMode("demo")}>Seeded</button>
              <button className={mode === "live" ? "active" : ""} onClick={() => setMode("live")}>Live Coral</button>
            </div>
            <div className="input-row">
              <GitPullRequest size={18} />
              <input id="pr-url" value={prUrl} onChange={(event) => setPrUrl(event.target.value)} />
              <button onClick={runAssessment} disabled={loading}>
                <Activity size={16} />
                {loading ? "Assessing" : "Run"}
              </button>
            </div>
            {error ? <div className="error-box">{error}</div> : null}
          </div>
          <SourceHealthPanel sources={report?.sourceHealth ?? sources} />
        </section>

        {report ? (
          <>
            <ReportView report={report} />
            <section className="comment-band">
              <div className="section-title">
                <h2>GitHub-ready PR Comment</h2>
                <button className="ghost-button" onClick={copyComment}>
                  <Clipboard size={16} />
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <pre>{report.prCommentMarkdown}</pre>
            </section>
            <QueryInspector queries={report.querySummaries} />
          </>
        ) : (
          <section className="empty-state">
            <h2>Run an assessment to see evidence-backed merge risk.</h2>
            <p>Try the risky demo PR or enter demo/shop#7 for a low-risk docs change.</p>
          </section>
        )}
      </section>
    </main>
  );
}
