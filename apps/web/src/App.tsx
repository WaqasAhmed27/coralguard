import {
  Activity,
  Bell,
  Clipboard,
  Database,
  GitPullRequest,
  Network,
  Search,
  ShieldAlert,
  User,
  Workflow
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AssessmentReport, SourceHealth } from "@coralguard/core";
import { SourceHealthPanel } from "./features/assessment/SourceHealthPanel.js";
import { MotionDemo } from "./features/demo/MotionDemo.js";
import { ReportView } from "./features/report/ReportView.js";
import { QueryInspector } from "./features/query-inspector/QueryInspector.js";

type Mode = "demo" | "live";
type CopyTarget = "comment" | "runbook" | `test-${string}` | null;

export function App() {
  const [prUrl, setPrUrl] = useState("https://github.com/demo/shop/pull/214");
  const [mode, setMode] = useState<Mode>("demo");
  const [report, setReport] = useState<AssessmentReport | null>(null);
  const [sources, setSources] = useState<SourceHealth[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<CopyTarget>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetch(`/api/sources/health?mode=${mode}`)
      .then((response) => response.json())
      .then(setSources)
      .catch(() => setSources([]));
  }, [mode]);

  const visibleSources = report?.sourceHealth ?? sources;
  const healthSummary = useMemo(() => summarizeHealth(visibleSources), [visibleSources]);
  const activeSources = visibleSources.filter((source) => source.status === "connected").length;
  const diffUrl = buildDiffUrl(report?.input.prUrl ?? prUrl);

  async function runAssessment() {
    setLoading(true);
    setError(null);
    setCopied(null);
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
      requestAnimationFrame(() => scrollToSection("risk"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Assessment failed.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  async function copyText(text: string, target: Exclude<CopyTarget, null>) {
    await navigator.clipboard.writeText(text);
    setCopied(target);
  }

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="ops-app">
      <header className="ops-topbar">
        <div className="topbar-left">
          <button className="brand-lockup" type="button" onClick={() => scrollToSection("dashboard")}>
            <ShieldAlert size={18} />
            <strong>CoralGuard</strong>
            <span>Pre-merge prevention</span>
          </button>
          <nav aria-label="Operational sections">
            <button type="button" onClick={() => scrollToSection("dashboard")}>Dashboard</button>
            <button type="button" onClick={() => scrollToSection("demo")}>Demo</button>
            <button type="button" onClick={() => scrollToSection("evidence")}>Incidents</button>
            <button type="button" onClick={() => scrollToSection("queries")}>Analytics</button>
            <button type="button" onClick={() => scrollToSection("sources")}>Nodes</button>
          </nav>
        </div>
        <div className="topbar-actions">
          <label className="global-search">
            <Search size={14} />
            <input
              aria-label="Search PRs, incidents, sources, and queries"
              placeholder="SEARCH PRS, INCIDENTS..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>
          <button
            className="icon-button"
            type="button"
            title={`${healthSummary.connected} connected, ${healthSummary.degraded} degraded`}
            onClick={() => scrollToSection("sources")}
          >
            <Network size={17} />
          </button>
          <button
            className="icon-button"
            type="button"
            title={`${report?.warnings.length ?? 0} source warnings`}
            onClick={() => scrollToSection(report?.warnings.length ? "warnings" : "sources")}
          >
            <Bell size={17} />
          </button>
          <button className="icon-button" type="button" title={mode === "live" ? "Live Coral mode" : "Seeded demo mode"}>
            <User size={16} />
          </button>
        </div>
      </header>

      <section className="ops-frame" id="dashboard">
        <section className="context-header">
          <div>
            <p className="eyebrow">Operational command center</p>
            <h1>{report ? reportTitle(report) : "Assess a GitHub PR before merge"}</h1>
          </div>
          <div className="context-actions">
            {report ? (
              <a className="outline-action" href={diffUrl} rel="noreferrer" target="_blank">
                View Diff
              </a>
            ) : null}
            {report ? (
              <a className="outline-action" href={`/api/assessments/${report.assessmentId}/export.md`}>
                Export MD
              </a>
            ) : null}
          </div>
        </section>

        <section className="command-strip" aria-label="Assessment controls">
          <div className="mode-switch" aria-label="Assessment mode">
            <button className={mode === "demo" ? "active" : ""} type="button" onClick={() => setMode("demo")}>
              Seeded
            </button>
            <button className={mode === "live" ? "active" : ""} type="button" onClick={() => setMode("live")}>
              Live Coral
            </button>
          </div>
          <label className="pr-input" htmlFor="pr-url">
            <GitPullRequest size={16} />
            <span>GitHub PR</span>
            <input id="pr-url" value={prUrl} onChange={(event) => setPrUrl(event.target.value)} />
          </label>
          <button className="run-button" type="button" onClick={runAssessment} disabled={loading}>
            <Activity size={16} />
            {loading ? "Assessing" : "Run"}
          </button>
        </section>

        {error ? <div className="error-box">{error}</div> : null}

        <div id="demo">
          <MotionDemo report={report} sources={visibleSources} />
        </div>

        {report ? (
          <>
            <ReportView
              copied={copied}
              onCopyText={copyText}
              onViewEvidence={() => scrollToSection("evidence")}
              report={report}
              searchTerm={searchTerm}
            />
            <QueryInspector queries={report.querySummaries} searchTerm={searchTerm} />
            <section className="comment-panel" id="comment">
              <div className="section-bar">
                <h2>GitHub-ready PR Comment</h2>
                <button type="button" onClick={() => copyText(report.prCommentMarkdown, "comment")}>
                  <Clipboard size={16} />
                  {copied === "comment" ? "Copied" : "Copy Comment"}
                </button>
              </div>
              <pre>{report.prCommentMarkdown}</pre>
            </section>
          </>
        ) : (
          <section className="ready-panel">
            <div>
              <h2>Ready for evidence-backed merge risk.</h2>
              <p>Enter a GitHub PR URL or keep the seeded risky PR, then run an assessment.</p>
            </div>
            <button type="button" onClick={runAssessment} disabled={loading}>
              <Workflow size={16} />
              Start Demo Assessment
            </button>
          </section>
        )}

        <SourceHealthPanel sources={visibleSources} searchTerm={searchTerm} activeCount={activeSources} />
      </section>
    </main>
  );
}

function reportTitle(report: AssessmentReport) {
  return `PR #${report.input.prNumber}: ${report.input.owner}/${report.input.repo} merge readiness`.toUpperCase();
}

function buildDiffUrl(prUrl: string) {
  if (/^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+\/?$/.test(prUrl)) {
    return `${prUrl.replace(/\/$/, "")}/files`;
  }
  return prUrl.startsWith("http") ? prUrl : "#evidence";
}

function summarizeHealth(sources: SourceHealth[]) {
  return sources.reduce(
    (summary, source) => {
      if (source.status === "connected") summary.connected += 1;
      else summary.degraded += 1;
      return summary;
    },
    { connected: 0, degraded: 0 }
  );
}
