# Live Credential Demo

CoralGuard supports a live-credential demo that uses Coral's bundled GitHub source for the PR itself while keeping local fallback evidence sources for CI, incidents, support, flags, and vulnerabilities.

This gives judges a real PR URL and real GitHub PR metadata/files without making the demo depend on every external SaaS credential.

## Setup

Install the live source config into an E-drive Coral config directory:

```powershell
$env:CORAL_CONFIG_DIR = "E:\OneDrive\Desktop\Coral\.coral-live-config"
powershell -ExecutionPolicy Bypass -File .\scripts\install-live-sources.ps1
```

The script uses `GITHUB_TOKEN` if set. If not, it uses `gh auth token` without printing the token.

## Run

```powershell
$env:CORAL_CONFIG_DIR = "E:\OneDrive\Desktop\Coral\.coral-live-config"
$env:CORAL_QUERY_PROFILE = "live"
npm run demo:coral -- https://github.com/WaqasAhmed27/coralguard/pull/1
```

For the web API, start it with the same environment variables and use `mode: "live"`.

## Credential Safety

- Do not commit `.coral-live-config`.
- Do not write tokens into `.env` files unless the file is gitignored.
- Coral stores source credentials locally.
- CoralGuard redacts command errors and source text before showing them in reports.
