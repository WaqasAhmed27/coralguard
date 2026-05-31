import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = process.cwd();
await loadEnvFile(path.join(root, ".env.live.local"));

const prUrl = process.argv[2] ?? process.env.LIVE_DEMO_PR_URL;
const createMode = process.argv.includes("--create") || process.env.CORAL_LIVE_CREATE === "1";
if (!prUrl) throw new Error("Usage: npm run sync:live-artifacts -- <PR_URL> [--create]");

const createLinear = createMode && process.env.CORAL_LIVE_CREATE_LINEAR !== "0";
const createLaunchDarkly = createMode && process.env.CORAL_LIVE_CREATE_LAUNCHDARKLY_FLAG === "1";
const postSlack = createMode && process.env.CORAL_LIVE_POST_SLACK === "1";
const allowCreateSentryProject = createMode && process.env.CORAL_LIVE_CREATE_SENTRY_PROJECT === "1";
const sendSentryEvent = createMode && process.env.CORAL_LIVE_SEND_SENTRY_EVENT === "1";

const parsed = parsePrUrl(prUrl);
const artifactRoot = path.join(root, "packages", "sources", "live_artifacts");
const marker = `CG-LIVE-DEMO-${parsed.owner}-${parsed.repo}-${parsed.prNumber}`.replace(/[^A-Za-z0-9_-]/g, "-");
const now = new Date().toISOString();

await mkdir(path.join(artifactRoot, "ci"), { recursive: true });
await mkdir(path.join(artifactRoot, "slack"), { recursive: true });
await mkdir(path.join(artifactRoot, "osv"), { recursive: true });

const files = await getPrFiles(parsed);
const changedFileNames = files.map((file) => file.filename);
const ciFailed = await runLocalCi();
await writeJsonl(path.join(artifactRoot, "ci", "test_failures.jsonl"), [
  ...(ciFailed
    ? [{
        pr_number: parsed.prNumber,
        test_name: "live demo payment retry regression",
        file_path: changedFileNames.includes("services/payments/retry.test.ts")
          ? "services/payments/retry.test.ts"
          : changedFileNames.find((file) => file.includes("payment")) ?? changedFileNames[0] ?? "services/payments/retry.ts",
        failure_message: "Local CI failed while validating the live demo branch.",
        failed_at: now
      }]
    : [])
]);
await writeJsonl(path.join(artifactRoot, "ci", "coverage_changes.jsonl"), coverageRows(parsed.prNumber, changedFileNames, now));
await writeJsonl(path.join(artifactRoot, "ci", "dependency_diff.jsonl"), [
  { pr_number: parsed.prNumber, dependency_name: "minimist", from_version: "1.2.8", to_version: "0.0.8" }
]);
await writeJsonl(path.join(artifactRoot, "ci", "sarif_findings.jsonl"), [
  {
    pr_number: parsed.prNumber,
    rule_id: "live-demo/payment-retry-idempotency",
    file_path: "services/payments/retry.ts",
    severity: "high",
    message: "Retry path allows duplicate payment confirmation without idempotency guard."
  }
]);
await writeJsonl(path.join(artifactRoot, "ci", "codeowners.jsonl"), [
  { path_prefix: "services/payments/", owner_team: "payments-platform", on_call: "payments-primary" },
  { path_prefix: "services/checkout/", owner_team: "checkout-platform", on_call: "checkout-primary" },
  { path_prefix: "packages/payments/", owner_team: "payments-platform", on_call: "payments-primary" }
]);

const slackIncident = await ensureSlackIncident(marker, createMode).catch((error) => {
  console.error(`Slack incident sync skipped: ${redact(String(error))}`);
  return null;
});
await writeJsonl(path.join(artifactRoot, "slack", "incidents.jsonl"), slackIncident ? [slackIncident] : []);
await writeJsonl(path.join(artifactRoot, "osv", "vulnerabilities.jsonl"), await fetchOsvRows("minimist", "0.0.8"));

const liveActions = await Promise.allSettled([
  ensureLinearIssue(marker, createLinear),
  ensureLaunchDarklyFlag(marker, createLaunchDarkly),
  ensureSentryEvent(marker, { createProject: allowCreateSentryProject, sendEvent: sendSentryEvent })
]);

console.log(JSON.stringify({
  prUrl,
  marker,
  changedFiles: changedFileNames.length,
  localCiFailed: ciFailed,
  slackIncident: Boolean(slackIncident),
  liveActions: liveActions.map((result) => result.status === "fulfilled" ? result.value : `failed: ${redact(String(result.reason))}`),
  artifactRoot
}, null, 2));

async function getPrFiles(input: { owner: string; repo: string; prNumber: number }) {
  const token = await githubToken();
  const response = await fetch(`https://api.github.com/repos/${input.owner}/${input.repo}/pulls/${input.prNumber}/files`, {
    headers: { authorization: `Bearer ${token}`, "user-agent": "coralguard-live-demo" }
  });
  if (!response.ok) throw new Error(`GitHub files request failed: ${response.status}`);
  return await response.json() as Array<{ filename: string }>;
}

async function githubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  const { stdout } = await execFileAsync("gh", ["auth", "token"], { cwd: root });
  return stdout.trim();
}

async function runLocalCi() {
  try {
    await execFileAsync("cmd.exe", ["/c", "npm", "test", "--", "--run"], { cwd: root, timeout: 120_000 });
    return false;
  } catch {
    return true;
  }
}

function coverageRows(prNumber: number, files: string[], timestamp: string) {
  return files
    .filter((file) => file.includes("payment") || file.includes("checkout"))
    .slice(0, 8)
    .map((file, index) => ({
      pr_number: prNumber,
      file_path: file,
      before_percent: index === 0 ? 92.5 : 86.0,
      after_percent: index === 0 ? 61.0 : 72.0,
      changed_at: timestamp
    }));
}

async function ensureSlackIncident(markerText: string, shouldCreate: boolean) {
  const token = process.env.SLACK_TOKEN;
  if (!token) return null;
  const channel = process.env.SLACK_CHANNEL_ID ?? await findOrCreateSlackChannel(token, "coralguard-live-demo", shouldCreate && postSlack);
  if (!channel) return null;
  const messageText = `${markerText} incident payments services/payments/retry.ts duplicate charge after checkout retry severity critical`;
  if (postSlack) {
    await slackApi("chat.postMessage", token, { channel, text: messageText });
  }
  const history = await slackApi("conversations.history", token, { channel, limit: 20 }) as {
    messages?: Array<{ text?: string; ts?: string }>;
  };
  const message = history.messages?.find((item) => item.text?.includes(markerText));
  if (!message) return null;
  return {
    incident_id: markerText,
    channel: "coralguard-live-demo",
    service: "payments",
    file_path: "services/payments/retry.ts",
    summary: message.text ?? messageText,
    severity: "critical",
    occurred_at: new Date(Number(message.ts?.split(".")[0] ?? Date.now() / 1000) * 1000).toISOString()
  };
}

async function findOrCreateSlackChannel(token: string, name: string, shouldCreate: boolean) {
  const list = await slackApi("conversations.list", token, { exclude_archived: true, limit: 1000 }) as {
    channels?: Array<{ id: string; name: string }>;
  };
  const existing = list.channels?.find((channel) => channel.name === name);
  if (existing) return existing.id;
  if (!shouldCreate) return null;
  const created = await slackApi("conversations.create", token, { name }) as { channel?: { id: string } };
  return created.channel?.id ?? null;
}

async function slackApi(method: string, token: string, body: Record<string, unknown>) {
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(body)
  });
  const json = await response.json() as { ok?: boolean; error?: string };
  if (!json.ok) throw new Error(`Slack ${method} failed: ${json.error}`);
  return json;
}

async function ensureLinearIssue(markerText: string, shouldCreate: boolean) {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) return "linear skipped";
  if (!shouldCreate) return "linear create skipped";
  const teams = await linearGraphql(apiKey, "{ teams(first: 1) { nodes { id key } } }") as {
    teams?: { nodes?: Array<{ id: string; key: string }> };
  };
  const team = teams.teams?.nodes?.[0];
  if (!team) return "linear no team";
  await linearGraphql(apiKey, `mutation($input: IssueCreateInput!) {
    issueCreate(input: $input) { success issue { identifier url } }
  }`, {
    input: {
      teamId: team.id,
      title: `${markerText} payments checkout duplicate charge support escalation`,
      description: "Live CoralGuard demo issue. payments checkout retry path is producing duplicate charge support escalations.",
      priority: 1,
      labelIds: []
    }
  });
  return `linear issue created in ${team.key}`;
}

async function linearGraphql(apiKey: string, query: string, variables?: Record<string, unknown>) {
  const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { authorization: apiKey, "content-type": "application/json" },
    body: JSON.stringify({ query, variables })
  });
  const json = await response.json() as { data?: unknown; errors?: unknown };
  if (json.errors) throw new Error(`Linear GraphQL failed: ${JSON.stringify(json.errors)}`);
  return json.data;
}

async function ensureLaunchDarklyFlag(markerText: string, shouldCreate: boolean) {
  const token = process.env.LAUNCHDARKLY_TOKEN;
  if (!token) return "launchdarkly skipped";
  if (!shouldCreate) return "launchdarkly create skipped";
  const flagKey = "payments-live-demo-checkout-retry";
  const environmentKey = process.env.CORAL_LIVE_LD_ENVIRONMENT ?? "test";
  const body = {
    key: flagKey,
    name: `${markerText} payments checkout retry`,
    description: "Live CoralGuard demo flag for high-exposure payments checkout retry path.",
    tags: ["payments", "checkout", "coralguard-live-demo"],
    variations: [{ value: true, name: "enabled" }, { value: false, name: "disabled" }],
    defaults: { onVariation: 0, offVariation: 1 }
  };
  const created = await fetch("https://app.launchdarkly.com/api/v2/flags/default", {
    method: "POST",
    headers: { authorization: token, "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!created.ok && created.status !== 409) throw new Error(`LaunchDarkly flag create failed: ${created.status}`);
  const patch = await fetch(`https://app.launchdarkly.com/api/v2/flags/default/${flagKey}`, {
    method: "PATCH",
    headers: { authorization: token, "content-type": "application/json; domain-model=launchdarkly.semanticpatch" },
    body: JSON.stringify({ environmentKey, instructions: [{ kind: "turnFlagOn" }] })
  });
  if (!patch.ok && patch.status !== 404) throw new Error(`LaunchDarkly flag patch failed: ${patch.status}`);
  return `launchdarkly flag ready in ${environmentKey}`;
}

async function ensureSentryEvent(markerText: string, options: { createProject: boolean; sendEvent: boolean }) {
  const org = process.env.SENTRY_ORG;
  const token = process.env.SENTRY_TOKEN;
  if (!org || !token) return "sentry skipped";
  if (!options.sendEvent) return "sentry event send skipped";
  const projects = await sentryApi(token, `/api/0/organizations/${org}/projects/`) as Array<{ slug: string }>;
  const project = projects.find((item) => item.slug.includes("payments") || item.slug.includes("checkout"))
    ?? (options.createProject ? await createSentryProject(org, token) : null);
  if (!project) return "sentry no payments/checkout project";
  const keys = await sentryApi(token, `/api/0/projects/${org}/${project.slug}/keys/`) as Array<{ dsn?: { public?: string } }>;
  const dsn = keys[0]?.dsn?.public;
  if (!dsn) return "sentry no dsn";
  await sendSentryStoreEvent(dsn, {
    message: `${markerText} payments checkout duplicate charge retry failure`,
    level: "error",
    platform: "javascript",
    logger: "coralguard-live-demo",
    tags: { service: "payments", route: "checkout" },
    exception: {
      values: [{
        type: "PaymentRetryDuplicateCharge",
        value: `${markerText} services/payments/retry.ts allowed duplicate checkout retry`
      }]
    }
  });
  return `sentry event sent to ${project.slug}`;
}

async function sentryApi(token: string, apiPath: string) {
  const response = await fetch(`https://sentry.io${apiPath}`, {
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }
  });
  if (!response.ok) throw new Error(`Sentry API failed: ${response.status}`);
  return await response.json();
}

async function createSentryProject(org: string, token: string) {
  const teams = await sentryApi(token, `/api/0/organizations/${org}/teams/`) as Array<{ slug: string }>;
  const team = teams[0];
  if (!team) return null;
  const response = await fetch(`https://sentry.io/api/0/teams/${org}/${team.slug}/projects/`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ name: "payments", slug: "payments", platform: "javascript" })
  });
  if (!response.ok && response.status !== 409) throw new Error(`Sentry project create failed: ${response.status}`);
  const projects = await sentryApi(token, `/api/0/organizations/${org}/projects/`) as Array<{ slug: string }>;
  return projects.find((item) => item.slug === "payments") ?? projects[0] ?? null;
}

async function sendSentryStoreEvent(dsn: string, event: Record<string, unknown>) {
  const parsedDsn = new URL(dsn);
  const publicKey = parsedDsn.username;
  const projectId = parsedDsn.pathname.replace("/", "");
  const endpoint = `${parsedDsn.origin}/api/${projectId}/store/?sentry_key=${publicKey}&sentry_version=7`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event)
  });
  if (!response.ok) throw new Error(`Sentry event ingest failed: ${response.status}`);
}

async function fetchOsvRows(packageName: string, version: string) {
  const response = await fetch("https://api.osv.dev/v1/query", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ package: { name: packageName, ecosystem: "npm" }, version })
  });
  if (!response.ok) throw new Error(`OSV query failed: ${response.status}`);
  const json = await response.json() as { vulns?: Array<{ id: string; summary?: string; published?: string; severity?: Array<{ score?: string }> }> };
  return (json.vulns ?? []).slice(0, 25).map((vuln) => ({
    osv_id: vuln.id,
    package_name: packageName,
    affected_version: version,
    severity: vuln.severity?.[0]?.score ? "high" : "high",
    summary: vuln.summary ?? "OSV vulnerability affects introduced dependency.",
    published_at: vuln.published ?? ""
  }));
}

async function writeJsonl(file: string, rows: Array<Record<string, unknown>>) {
  await writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""), "utf8");
}

function parsePrUrl(url: string) {
  const match = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?$/.exec(url);
  if (!match) throw new Error("Expected a GitHub pull request URL.");
  return { owner: match[1], repo: match[2], prNumber: Number(match[3]) };
}

function loadEnvFile(file: string) {
  return readFile(file, "utf8").then((content) => {
    for (const line of content.split(/\r?\n/)) {
      const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim());
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^"|"$/g, "");
    }
  }).catch(() => undefined);
}

function redact(value: string) {
  return value.replace(/(api|xoxb|sntryu|lin_api)_[A-Za-z0-9_-]+/g, "[REDACTED]");
}
