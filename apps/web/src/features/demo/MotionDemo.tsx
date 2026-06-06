import {
  AlertTriangle,
  Bug,
  CircleDot,
  DatabaseZap,
  Flag,
  GitPullRequest,
  MessageSquareWarning,
  PackageSearch,
  ShieldCheck,
  Siren,
  TestTube2,
  TicketCheck
} from "lucide-react";
import type { CSSProperties } from "react";
import type { AssessmentReport, SourceHealth } from "@coralguard/core";

const sourceNodes = [
  { id: "github", label: "GitHub", metric: "17 files", icon: GitPullRequest },
  { id: "ci_artifacts", label: "CI", metric: "1 failure", icon: TestTube2 },
  { id: "sentry", label: "Sentry", metric: "4 issues", icon: Bug },
  { id: "slack_incidents", label: "Slack", metric: "1 incident", icon: MessageSquareWarning },
  { id: "linear", label: "Linear", metric: "2 tickets", icon: TicketCheck },
  { id: "launchdarkly", label: "Flags", metric: "4 rollouts", icon: Flag },
  { id: "osv", label: "OSV", metric: "2 vulns", icon: PackageSearch }
];

export function MotionDemo({ report, sources }: { report: AssessmentReport | null; sources: SourceHealth[] }) {
  const score = report?.riskScore ?? 100;
  const evidenceCount = report?.evidence.length ?? 49;
  const confidence = report ? Math.round(report.confidence * 100) : 70;
  const verdict = report?.riskLevel ?? "critical";
  const sourceStatus = new Map(sources.map((source) => [source.name, source.status]));

  return (
    <section className="motion-demo" aria-label="Animated CoralGuard live scan">
      <div className="motion-copy">
        <p className="eyebrow">Live scan replay</p>
        <h2>Coral joins the PR with operational evidence before merge.</h2>
        <div className="motion-stats" aria-label="Scan summary">
          <span><strong>{score}</strong> risk</span>
          <span><strong>{evidenceCount}</strong> rows</span>
          <span><strong>{confidence}%</strong> confidence</span>
        </div>
      </div>

      <div className="scan-stage" aria-hidden="true">
        <div className="scan-phase-rail">
          <span>PR intake</span>
          <span>Coral SQL join</span>
          <span>Risk verdict</span>
        </div>
        <div className="scan-packet-lane">
          {["diff", "ci", "err", "inc", "flag", "vuln"].map((label, index) => (
            <span
              className="lane-packet"
              key={label}
              style={{ "--packet-delay": `${index * 0.42}s` } as CSSProperties}
            >
              {label}
            </span>
          ))}
        </div>
        <div className="scan-grid">
          <div className="pr-node">
            <GitPullRequest size={24} />
            <span>PR #2</span>
            <strong>payments retry</strong>
          </div>

          <div className="coral-core">
            <div className="core-ring" />
            <DatabaseZap size={34} />
            <span>Coral SQL</span>
            <strong>evidence join</strong>
          </div>

          <div
            className={`verdict-node verdict-${verdict}`}
            style={{ "--risk-score": `${score}%` } as CSSProperties}
          >
            <AlertTriangle size={24} />
            <span>{verdict}</span>
            <strong>{score}/100</strong>
            <div className="risk-meter"><i /></div>
          </div>

          <svg className="scan-lines" viewBox="0 0 920 360" preserveAspectRatio="none">
            <path className="scan-line line-a" d="M105 178 C215 178 235 178 345 178" />
            <path className="scan-line line-b" d="M575 178 C695 178 720 178 830 178" />
            <path className="scan-line line-c" d="M460 90 C460 122 460 132 460 160" />
            <path className="scan-line line-d" d="M460 200 C460 232 460 245 460 278" />
            <path className="scan-line line-e" d="M380 120 C332 75 260 70 192 92" />
            <path className="scan-line line-f" d="M540 120 C590 75 662 70 730 92" />
            <path className="scan-line line-g" d="M380 236 C328 290 260 300 190 276" />
            <path className="scan-line line-h" d="M540 236 C596 292 670 302 738 276" />
          </svg>

          <div className="source-orbit">
            {sourceNodes.map((source, index) => {
              const Icon = source.icon;
              const connected = sourceStatus.get(source.id) === "connected" || sourceStatus.size === 0;
              return (
                <div
                  className={`source-chip source-chip-${index} ${connected ? "source-chip-live" : "source-chip-muted"}`}
                  key={source.id}
                >
                  <Icon size={15} />
                  <span>{source.label}</span>
                  <strong>{source.metric}</strong>
                </div>
              );
            })}
          </div>
        </div>

        <div className="merge-comment">
          <div className="comment-row">
            <ShieldCheck size={15} />
            <span>PR comment generated</span>
          </div>
          <strong>Block merge until duplicate-charge retry is fixed.</strong>
          <div className="comment-evidence">
            <span><Siren size={13} /> Slack incident</span>
            <span><Bug size={13} /> Sentry issue</span>
            <span><CircleDot size={13} /> failing CI</span>
          </div>
        </div>
      </div>
    </section>
  );
}
