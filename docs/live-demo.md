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

If you copied a token block locally, import it from the clipboard without
printing token values:

```powershell
npm run import:live-secrets
```

Install the live source config into an E-drive Coral config directory:

```powershell
npm run check:live-env
npm run install:live-sources
```

The script uses `GITHUB_TOKEN` if set. If not, it uses `gh auth token` without printing the token. It installs bundled Coral sources for any provided live credentials and keeps local fallback sources for missing systems.

For a true all-live demo, use the strict installer. It refuses to continue if
Sentry, Slack, LaunchDarkly, or Linear credentials are missing:

```powershell
npm run install:live-sources:strict
```

If Slack fails with `missing_scope`, update the Slack bot token scopes and
reinstall the app. The current token has only `incoming-webhook`; Coral's Slack
source validates `slack.channels` through `conversations.list`, which needs:
`channels:read`, `groups:read`, `mpim:read`, and `im:read`. Include
`users:read` for the `slack.users` table.

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
