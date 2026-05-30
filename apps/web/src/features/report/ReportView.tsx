import { AlertTriangle, Clipboard, Eye, ListChecks, Radar, RotateCcw, Users } from "lucide-react";
import type React from "react";
import type { AssessmentReport, Evidence, TestPlanItem } from "@coralguard/core";

type CopyTarget = "comment" | "runbook" | `test-${string}`;

export function ReportView({
  copied,
  onCopyText,
  onViewEvidence,
  report,
  searchTerm = ""
}: {
  copied: CopyTarget | null;
  onCopyText: (text: string, target: CopyTarget) => Promise<void>;
  onViewEvidence: () => void;
  report: AssessmentReport;
  searchTerm?: string;
}) {
  const filteredTests = filterTests(report.testPlan, searchTerm);
  const filteredEvidence = filterEvidence(report.evidence, searchTerm);
  const rollbackText = buildRunbook(report);

  return (
    <>
      <section className={`risk-command risk-${report.riskLevel}`} id="risk">
        <div className="risk-label">Merge Risk Assessment</div>
        <div className="risk-headline">
          <h2>{report.riskLevel.toUpperCase()}</h2>
          <strong>{report.riskScore}/100</strong>
        </div>
        <div className="risk-rule" />
        <p>CONFIDENCE: {Math.round(report.confidence * 100)}% - {report.recommendation.toUpperCase()}</p>
        <span className="recommendation-copy">{report.recommendation}</span>
        <div className="risk-meta-grid">
          <MetaBlock label="Service" value={firstOr(report.blastRadius.affectedServices, report.input.repo)} />
          <MetaBlock label="Owners" value={firstOr(report.blastRadius.codeOwners, "unresolved")} />
          <MetaBlock label="Impact" value={report.riskLevel} />
        </div>
      </section>

      <section className="test-panel">
        <div className="section-bar inverse">
          <h2>
            <ListChecks size={16} />
            Suggested Tests
          </h2>
          <button type="button" onClick={onViewEvidence}>
            <Eye size={16} />
            View Evidence
          </button>
        </div>
        <div className="test-list">
          {filteredTests.map((item, index) => (
            <article className="test-item" key={item.id}>
              <div className={`severity-dot severity-dot-${index}`} />
              <div>
                <h3>{item.title}</h3>
                <p>{item.reason}</p>
                <span>{item.evidenceIds.join(" + ")}</span>
              </div>
              <button type="button" onClick={() => onCopyText(formatTest(item), `test-${item.id}`)}>
                <Clipboard size={15} />
                {copied === `test-${item.id}` ? "Copied" : "Copy Check"}
              </button>
            </article>
          ))}
          {!filteredTests.length ? <p className="empty-inline">No suggested tests match the current search.</p> : null}
        </div>
      </section>

      <section className="blast-panel">
        <div className="section-bar">
          <h2>
            <Radar size={16} />
            Blast Radius
          </h2>
        </div>
        <div className="blast-grid">
          <ChipGroup label="Services" values={report.blastRadius.affectedServices} />
          <ChipGroup label="Routes" values={report.blastRadius.affectedRoutes} />
          <ChipGroup label="Flags" values={report.blastRadius.featureFlags} />
          <ChipGroup label="Segments" values={report.blastRadius.customerSegments} />
          <ChipGroup label="Support Queues" values={report.blastRadius.supportQueues} />
          <ChipGroup label="On-call" values={report.blastRadius.onCallOwners} />
        </div>
      </section>

      <section className="rollback-panel">
        <div className="section-bar">
          <h2>
            <RotateCcw size={16} />
            Rollback Plan
          </h2>
          <button type="button" onClick={() => onCopyText(rollbackText, "runbook")}>
            <Clipboard size={16} />
            {copied === "runbook" ? "Copied" : "Copy Runbook"}
          </button>
        </div>
        <pre className="revert-command">{report.rollbackPlan.revertCommand}</pre>
        <div className="rollback-grid">
          <ChipGroup label="Owners to Notify" values={report.rollbackPlan.ownersToNotify} icon={<Users size={14} />} />
          <ChipGroup label="Metrics to Watch" values={report.rollbackPlan.metricsToWatch} />
          <ChipGroup label="Sentry Queries" values={report.rollbackPlan.sentryQueries} />
          <ChipGroup label="Flag Actions" values={report.rollbackPlan.featureFlagActions} />
          <ChipGroup label="Notes" values={report.rollbackPlan.notes} />
        </div>
      </section>

      <section className="evidence-panel" id="evidence">
        <div className="section-bar">
          <h2>Evidence Timeline</h2>
          <span>{filteredEvidence.length} of {report.evidence.length} structured rows</span>
        </div>
        <div className="evidence-table-wrap">
          <table className="evidence-table">
            <thead>
              <tr>
                <th>Sev</th>
                <th>Source</th>
                <th>Timestamp</th>
                <th>Event</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvidence
                .slice()
                .sort(sortEvidence)
                .map((item) => (
                  <tr key={item.id}>
                    <td><span className={`severity-mark severity-${item.severity}`} /></td>
                    <td>{item.source}</td>
                    <td>{item.timestamp ? new Date(item.timestamp).toLocaleString() : "no timestamp"}</td>
                    <td>
                      <strong>{item.title}</strong>
                      <span>{item.summary}</span>
                    </td>
                    <td>
                      <code>{item.id}</code>
                      <code>{item.sqlQueryId}</code>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!filteredEvidence.length ? <p className="empty-inline">No evidence rows match the current search.</p> : null}
        </div>
      </section>

      {report.warnings.length ? (
        <section className="warning-panel" id="warnings">
          <AlertTriangle size={18} />
          <div>
            <h2>Degraded Queries</h2>
            {report.warnings.map((warning) => <p key={warning}>{warning}</p>)}
          </div>
        </section>
      ) : null}
    </>
  );
}

function MetaBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value.toUpperCase()}</strong>
    </div>
  );
}

function ChipGroup({ icon, label, values }: { icon?: React.ReactNode; label: string; values: string[] }) {
  return (
    <div className="chip-group">
      <span>{icon}{label}</span>
      <div>
        {values.length ? values.map((value) => <code key={value}>{value}</code>) : <em>none</em>}
      </div>
    </div>
  );
}

function firstOr(values: string[], fallback: string) {
  return values[0] ?? fallback;
}

function filterTests(testPlan: TestPlanItem[], searchTerm: string) {
  const needle = searchTerm.trim().toLowerCase();
  if (!needle) return testPlan;
  return testPlan.filter((item) =>
    [item.title, item.reason, item.evidenceIds.join(" ")].some((value) => value.toLowerCase().includes(needle))
  );
}

function filterEvidence(evidence: Evidence[], searchTerm: string) {
  const needle = searchTerm.trim().toLowerCase();
  if (!needle) return evidence;
  return evidence.filter((item) =>
    [item.id, item.source, item.title, item.summary, item.sqlQueryId, item.entityRefs.join(" ")]
      .some((value) => value.toLowerCase().includes(needle))
  );
}

function sortEvidence(a: Evidence, b: Evidence) {
  return new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime();
}

function formatTest(item: TestPlanItem) {
  return [
    item.title,
    item.reason,
    `Evidence: ${item.evidenceIds.join(", ")}`
  ].join("\n");
}

function buildRunbook(report: AssessmentReport) {
  return [
    `Rollback for ${report.input.owner}/${report.input.repo}#${report.input.prNumber}`,
    `Revert: ${report.rollbackPlan.revertCommand}`,
    `Owners: ${report.rollbackPlan.ownersToNotify.join(", ") || "none"}`,
    `Metrics: ${report.rollbackPlan.metricsToWatch.join(", ") || "none"}`,
    `Sentry: ${report.rollbackPlan.sentryQueries.join(", ") || "none"}`,
    `Flags: ${report.rollbackPlan.featureFlagActions.join("; ") || "none"}`,
    ...report.rollbackPlan.notes.map((note) => `Note: ${note}`)
  ].join("\n");
}
