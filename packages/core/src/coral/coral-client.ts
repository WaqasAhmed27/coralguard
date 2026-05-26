import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ParsedPr } from "../schemas/input.js";
import { redactForDisplay } from "../security/redact.js";
import { bindSql, getQuery, type QueryId } from "./query-registry.js";

export type QueryRow = Record<string, unknown>;

export interface CoralClient {
  runQuery(queryId: QueryId, input: ParsedPr): Promise<QueryRow[]>;
}

export class CoralCliClient implements CoralClient {
  constructor(private readonly coralBin = "coral", private readonly timeoutMs = 10_000) {}

  async runQuery(queryId: QueryId, input: ParsedPr): Promise<QueryRow[]> {
    const query = bindSql(getQuery(queryId), input);
    const args = ["sql", "--format", "json", query];
    const output = await runSafeCommand(this.coralBin, args, this.timeoutMs);
    try {
      const parsed = JSON.parse(output);
      return Array.isArray(parsed) ? parsed : parsed.rows ?? [];
    } catch (error) {
      throw new Error(`Coral returned invalid JSON for ${queryId}: ${redactForDisplay(String(error))}`);
    }
  }
}

export async function runSafeCommand(command: string, args: string[], timeoutMs: number): Promise<string> {
  if (args.some((arg) => /[;&|`$<>\n\r]/.test(arg) && arg !== args.at(-1))) {
    throw new Error("Unsafe shell metacharacter in command argument.");
  }

  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Coral query timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(new Error(redactForDisplay(error.message)));
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(redactForDisplay(stderr || `Coral exited with code ${code}`)));
      }
    });
  });
}

export class DemoCoralClient implements CoralClient {
  private readonly root: string;
  private cache = new Map<string, QueryRow[]>();

  constructor(root = path.join(findWorkspaceRootSync(), "packages", "sources", "demo_data")) {
    this.root = root;
  }

  async runQuery(queryId: QueryId, input: ParsedPr): Promise<QueryRow[]> {
    const githubPrs = await this.readTable("github", "pull_requests");
    const changedFiles = (await this.readTable("github", "pull_request_files")).filter(matchesPr(input));
    const services = new Set(changedFiles.map((row) => String(row.service ?? "")).filter(Boolean));

    switch (queryId) {
      case "github.pr_summary":
        return githubPrs.filter(matchesPr(input)).slice(0, 1);
      case "github.changed_files":
        return changedFiles.slice(0, 200);
      case "ci.failures_for_changed_files": {
        const changed = new Set(changedFiles.map((row) => row.file_path));
        return (await this.readTable("ci", "test_failures"))
          .filter((row) => Number(row.pr_number) === input.prNumber && changed.has(row.file_path))
          .slice(0, 50);
      }
      case "ci.coverage_for_changed_files": {
        const changed = new Set(changedFiles.map((row) => row.file_path));
        return (await this.readTable("ci", "coverage_changes")).filter((row) => changed.has(row.file_path)).slice(0, 50);
      }
      case "risk.recent_errors_by_service":
        return (await this.readTable("sentry", "issues"))
          .filter((row) => services.has(String(row.service)) && Number(row.event_count_7d ?? 0) > 0)
          .sort((a, b) => Number(b.event_count_7d ?? 0) - Number(a.event_count_7d ?? 0))
          .slice(0, 25);
      case "risk.related_incidents_by_file": {
        const changed = new Set(changedFiles.map((row) => row.file_path));
        return (await this.readTable("slack", "incidents"))
          .filter((row) => services.has(String(row.service)) || changed.has(row.file_path))
          .slice(0, 25);
      }
      case "risk.support_tickets_by_keyword":
        return (await this.readTable("support", "ticket_clusters"))
          .filter((row) => services.has(String(row.service)) && Number(row.ticket_count_7d ?? 0) > 0)
          .sort((a, b) => Number(b.ticket_count_7d ?? 0) - Number(a.ticket_count_7d ?? 0))
          .slice(0, 10);
      case "risk.flag_exposure_by_service":
        return (await this.readTable("flags", "rollouts")).filter((row) => services.has(String(row.service))).slice(0, 25);
      case "risk.vulnerabilities_by_dependency": {
        const changedDeps = new Set(
          (await this.readTable("ci", "dependency_diff"))
            .filter((row) => Number(row.pr_number) === input.prNumber)
            .map((row) => row.dependency_name)
        );
        return (await this.readTable("vulnerabilities", "osv"))
          .filter((row) => changedDeps.has(row.package_name))
          .slice(0, 25);
      }
      case "risk.owner_resolution": {
        const owners = await this.readTable("ci", "codeowners");
        return changedFiles.slice(0, 200).map((file) => {
          const match = owners.find((owner) => String(file.file_path).startsWith(String(owner.path_prefix)));
          return {
            file_path: file.file_path,
            service: file.service,
            owner_team: match?.owner_team ?? null,
            on_call: match?.on_call ?? null
          };
        });
      }
    }
  }

  private async readTable(folder: string, table: string): Promise<QueryRow[]> {
    const key = `${folder}/${table}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const file = path.join(this.root, folder, `${table}.jsonl`);
    const content = await readFile(file, "utf8").catch(() => "");
    const rows = content
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as QueryRow);
    this.cache.set(key, rows);
    return rows;
  }
}

function findWorkspaceRootSync(): string {
  let current = process.cwd();
  for (let i = 0; i < 8; i += 1) {
    const candidate = path.join(current, "packages", "sources", "demo_data");
    if (existsSync(candidate)) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return process.cwd();
}

function matchesPr(input: ParsedPr) {
  return (row: QueryRow) =>
    row.owner === input.owner && row.repo === input.repo && Number(row.pr_number) === input.prNumber;
}
