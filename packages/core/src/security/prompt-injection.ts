import type { Evidence } from "../schemas/evidence.js";

const promptInjectionSignals = [
  /ignore (all )?(previous|above|system|developer) instructions/i,
  /reveal|leak|print.*secret/i,
  /hide this issue/i,
  /you are now/i
];

export function containsPromptInjection(text: string): boolean {
  return promptInjectionSignals.some((pattern) => pattern.test(text));
}

export function validateEvidenceReferences(text: string, evidence: Evidence[]): boolean {
  const known = new Set(evidence.map((item) => item.id));
  const referenced = Array.from(text.matchAll(/\bEV-[A-Z0-9-]+\b/g)).map((match) => match[0]);
  return referenced.every((id) => known.has(id));
}
