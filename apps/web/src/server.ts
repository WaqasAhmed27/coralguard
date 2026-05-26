import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import staticPlugin from "@fastify/static";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  assessPullRequest,
  assessmentReportSchema,
  getSourceHealth,
  prInputSchema,
  redactForDisplay,
  type AssessmentReport
} from "@coralguard/core";

export function buildApp() {
  const app = Fastify({ logger: false });
  registerRoutes(app);
  return app;
}

const reports = new Map<string, AssessmentReport>();
const root = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const reportDir = path.join(root, "reports");

function registerRoutes(app: FastifyInstance) {
  app.get("/api/sources/health", async () => getSourceHealth("demo"));

  app.post("/api/assess", async (request, reply) => {
    try {
      const input = prInputSchema.parse(request.body);
      const report = await assessPullRequest(input);
      reports.set(report.assessmentId, report);
      await mkdir(reportDir, { recursive: true });
      await writeFile(path.join(reportDir, `${safeId(report.assessmentId)}.json`), JSON.stringify(report, null, 2));
      return report;
    } catch (error) {
      reply.code(400);
      return { error: redactForDisplay(error instanceof Error ? error.message : String(error)) };
    }
  });

  app.get("/api/assessments/:id", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const report = await loadReport(id);
    if (!report) {
      reply.code(404);
      return { error: "Assessment not found." };
    }
    return report;
  });

  app.get("/api/assessments/:id/export.md", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const report = await loadReport(id);
    if (!report) {
      reply.code(404);
      return "Assessment not found.";
    }
    reply.header("content-type", "text/markdown; charset=utf-8");
    return exportMarkdown(report);
  });

  const staticRoot = path.join(root, "apps", "web", "dist");
  app.register(staticPlugin, { root: staticRoot, prefix: "/" }).after(() => {});

  app.setNotFoundHandler(async (_request, reply) => {
    const index = path.join(staticRoot, "index.html");
    try {
      reply.header("content-type", "text/html; charset=utf-8");
      return await readFile(index, "utf8");
    } catch {
      reply.code(404);
      return { error: "Not found." };
    }
  });
}

const port = Number(process.env.PORT ?? 8787);

export async function startServer() {
  const app = buildApp();
  await app.listen({ host: "127.0.0.1", port });
  return app;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  startServer().catch((error) => {
    console.error(redactForDisplay(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  });
}

async function loadReport(id: string): Promise<AssessmentReport | null> {
  const cached = reports.get(id);
  if (cached) return cached;
  try {
    const content = await readFile(path.join(reportDir, `${safeId(id)}.json`), "utf8");
    return assessmentReportSchema.parse(JSON.parse(content));
  } catch {
    return null;
  }
}

function exportMarkdown(report: AssessmentReport): string {
  return [
    `# CoralGuard Report: ${report.input.owner}/${report.input.repo}#${report.input.prNumber}`,
    "",
    report.prCommentMarkdown,
    "",
    "## Blast Radius",
    `- Services: ${report.blastRadius.affectedServices.join(", ") || "none"}`,
    `- Flags: ${report.blastRadius.featureFlags.join(", ") || "none"}`,
    `- Owners: ${report.blastRadius.codeOwners.join(", ") || "none"}`,
    "",
    "## Rollback",
    `- Revert: \`${report.rollbackPlan.revertCommand}\``,
    ...report.rollbackPlan.featureFlagActions.map((item) => `- ${item}`)
  ].join("\n");
}

function safeId(id: string): string {
  return id.replace(/[^A-Za-z0-9_.-]/g, "_");
}
