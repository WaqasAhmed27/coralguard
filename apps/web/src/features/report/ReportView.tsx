import { AlertTriangle, GitBranch, ListChecks, Radar, RotateCcw, Users } from "lucide-react";
import type React from "react";
import type { AssessmentReport, Evidence } from "@coralguard/core";

export function ReportView({ report }: { report: AssessmentReport }) {
  return (
    <section className="report-grid">
      <div className={`risk-panel risk-${report.riskLevel}`}>
        <div className="risk-score">{report.riskScore}</div>
        <div>
          <span className="label">Merge Risk</span>
          <h2>{report.riskLevel.toUpperCase()}</h2>
          <p>{report.recommendation}</p>
          <small>Confidence {Math.round(report.confidence * 100)}%</small>
        </div>
      </div>

      <InfoPanel icon={<Radar size={18} />} title="Blast Radius">
        <ChipList label="Services" values={report.blastRadius.affectedServices} />
        <ChipList label="Flags" values={report.blastRadius.featureFlags} />
        <ChipList label="Segments" values={report.blastRadius.customerSegments} />
        <ChipList label="Owners" values={report.blastRadius.codeOwners} />
      </InfoPanel>

      <InfoPanel icon={<ListChecks size={18} />} title="Suggested Tests">
        <ul className="tight-list">
          {report.testPlan.map((item) => (
            <li key={item.id}>
              <strong>{item.title}</strong>
              <span>{item.reason}</span>
              <code>{item.evidenceIds.join(", ")}</code>
            </li>
          ))}
        </ul>
      </InfoPanel>

      <InfoPanel icon={<RotateCcw size={18} />} title="Rollback Plan">
        <ul className="tight-list">
          <li><strong>Revert</strong><code>{report.rollbackPlan.revertCommand}</code></li>
          {report.rollbackPlan.featureFlagActions.map((action) => <li key={action}>{action}</li>)}
          {report.rollbackPlan.sentryQueries.map((query) => <li key={query}><strong>Watch</strong><code>{query}</code></li>)}
        </ul>
      </InfoPanel>

      <section className="timeline">
        <div className="section-title">
          <h2>Evidence Timeline</h2>
          <span>{report.evidence.length} structured rows</span>
        </div>
        <div className="timeline-list">
          {report.evidence
            .slice()
            .sort(sortEvidence)
            .map((item) => (
              <article className="evidence-card" key={item.id}>
                <div className="evidence-meta">
                  <span className={`severity severity-${item.severity}`}>{item.severity}</span>
                  <span>{item.source}</span>
                  <span>{item.timestamp ? new Date(item.timestamp).toLocaleString() : "no timestamp"}</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.summary}</p>
                <footer>
                  <code>{item.id}</code>
                  <code>{item.sqlQueryId}</code>
                </footer>
              </article>
            ))}
        </div>
      </section>

      {report.warnings.length ? (
        <section className="warning-panel">
          <AlertTriangle size={18} />
          <div>
            <h2>Degraded Queries</h2>
            {report.warnings.map((warning) => <p key={warning}>{warning}</p>)}
          </div>
        </section>
      ) : null}
    </section>
  );
}

function InfoPanel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="info-panel">
      <div className="section-title compact">
        <h2>{title}</h2>
        {icon}
      </div>
      {children}
    </section>
  );
}

function ChipList({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="chip-row">
      <span>{label}</span>
      <div>{values.length ? values.map((value) => <code key={value}>{value}</code>) : <em>none</em>}</div>
    </div>
  );
}

function sortEvidence(a: Evidence, b: Evidence) {
  return new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime();
}
