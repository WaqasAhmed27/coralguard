import { z } from "zod";

export const evidenceCategorySchema = z.enum([
  "code_change",
  "ci_failure",
  "runtime_error",
  "incident_history",
  "customer_signal",
  "feature_flag_exposure",
  "security_finding",
  "ownership"
]);

export const severitySchema = z.enum(["low", "medium", "high", "critical"]);

export const evidenceSchema = z.object({
  id: z.string(),
  category: evidenceCategorySchema,
  source: z.string(),
  title: z.string(),
  summary: z.string(),
  severity: severitySchema,
  confidence: z.number().min(0).max(1),
  timestamp: z.string().nullable(),
  entityRefs: z.array(z.string()),
  sqlQueryId: z.string(),
  rawRowHash: z.string()
});

export type Evidence = z.infer<typeof evidenceSchema>;
export type EvidenceCategory = z.infer<typeof evidenceCategorySchema>;
export type Severity = z.infer<typeof severitySchema>;
