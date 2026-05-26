# CoralGuard Threat Model

Main controls:

- PR input is parsed with strict GitHub owner, repo, and PR number validation.
- Shell execution uses `spawn` with argument arrays through `coral-client.ts`.
- SQL text comes only from `query-registry.ts`; user-written SQL is not accepted.
- Reports use normalized evidence and row hashes instead of raw source rows.
- Secret and PII redaction is centralized in `security/redact.ts`.
- Source text is treated as untrusted data. Prompt-injection phrases lower evidence confidence but cannot alter scoring or hidden instructions.

The seeded dataset includes malicious PR text, a support-ticket secret, and PII-like content to keep these controls visible in tests and demos.
