# CoralGuard Architecture

CoralGuard keeps Coral as the retrieval and join layer. The core package owns PR parsing, source health, a fixed query registry, Coral CLI execution, seeded demo execution, evidence normalization, deterministic scoring, and report generation.

The web app is deliberately thin. It submits a PR input to `/api/assess`, renders the normalized report, and exposes the SQL query inspector so a judge can see which Coral SQL templates produced each evidence row.

Demo mode uses JSONL fixtures under `packages/sources/demo_data` and the same query IDs as live mode. Live mode swaps the seeded runner for `CoralCliClient`, which calls `coral sql --format json` through `spawn` with argument arrays.
