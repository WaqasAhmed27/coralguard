# Live Credential Demo

CoralGuard supports a live-credential demo that uses Coral's bundled GitHub source for the PR itself while keeping local fallback evidence sources for CI, incidents, support, flags, and vulnerabilities.

This gives judges a real PR URL and real GitHub PR metadata/files without making the demo depend on every external SaaS credential.

## Setup

Copy the example env file and paste real values locally:

```powershell
Copy-Item .\env.live.example .\.env.live.local
notepad .\.env.live.local
```

Or use the local prompt helper so token values are not echoed:

```powershell
npm run set:live-secrets
```

Install the live source config into an E-drive Coral config directory:

```powershell
npm run install:live-sources
```

The script uses `GITHUB_TOKEN` if set. If not, it uses `gh auth token` without printing the token. It installs bundled Coral sources for any provided live credentials and keeps local fallback sources for missing systems.

## Run

```powershell
. .\scripts\load-live-env.ps1
npm run demo:coral -- https://github.com/WaqasAhmed27/coralguard/pull/1
```

For the web UI:

```powershell
npm run dev:live
```

## Credential Safety

- Do not commit `.coral-live-config`.
- Do not commit `.env.live.local`.
- Do not write tokens into `.env` files unless the file is gitignored.
- Coral stores source credentials locally.
- CoralGuard redacts command errors and source text before showing them in reports.
