import { z } from "zod";
import { evidenceSchema } from "./evidence.js";

export const sourceHealthSchema = z.object({
  name: z.string(),
  status: z.enum(["connected", "missing_credentials", "failing", "not_installed", "optional_skipped"]),
  mode: z.enum(["live", "seeded"]),
  required: z.boolean(),
  message: z.string()
});

export const blastRadiusSchema = z.object({
  affectedServices: z.array(z.string()),
  affectedRoutes: z.array(z.string()),
  featureFlags: z.array(z.string()),
  customerSegments: z.array(z.string()),
  supportQueues: z.array(z.string()),
  codeOwners: z.array(z.string()),
  onCallOwners: z.array(z.string())
});

export const testPlanItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  reason: z.string(),
  evidenceIds: z.array(z.string())
});

export const rollbackPlanSchema = z.object({
  revertCommand: z.string(),
  featureFlagActions: z.array(z.string()),
  ownersToNotify: z.array(z.string()),
  metricsToWatch: z.array(z.string()),
  sentryQueries: z.array(z.string()),
  notes: z.array(z.string())
});

export const querySummarySchema = z.object({
  id: z.string(),
  label: z.string(),
  sql: z.string(),
  rowCount: z.number().int().nonnegative(),
  sourceNames: z.array(z.string())
});

export const assessmentReportSchema = z.object({
  assessmentId: z.string(),
  input: z.object({
    owner: z.string(),
    repo: z.string(),
    prNumber: z.number().int().positive(),
    prUrl: z.string()
  }),
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  riskScore: z.number().int().min(0).max(100),
  confidence: z.number().min(0).max(0.95),
  recommendation: z.string(),
  evidence: z.array(evidenceSchema),
  blastRadius: blastRadiusSchema,
  testPlan: z.array(testPlanItemSchema),
  rollbackPlan: rollbackPlanSchema,
  prCommentMarkdown: z.string(),
  sourceHealth: z.array(sourceHealthSchema),
  querySummaries: z.array(querySummarySchema),
  warnings: z.array(z.string()),
  generatedAt: z.string()
});

export type SourceHealth = z.infer<typeof sourceHealthSchema>;
export type BlastRadius = z.infer<typeof blastRadiusSchema>;
export type TestPlanItem = z.infer<typeof testPlanItemSchema>;
export type RollbackPlan = z.infer<typeof rollbackPlanSchema>;
export type QuerySummary = z.infer<typeof querySummarySchema>;
export type AssessmentReport = z.infer<typeof assessmentReportSchema>;
