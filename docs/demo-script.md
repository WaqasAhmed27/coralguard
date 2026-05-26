# CoralGuard Demo Script

1. Run `npm install`.
2. Run `npm run dev`.
3. Open `http://127.0.0.1:5173`.
4. Assess `https://github.com/demo/shop/pull/214`.
5. Show source health and seeded Coral status.
6. Show high merge risk, blast radius, test plan, rollback plan, and PR comment.
7. Open the Coral SQL query inspector and expand a joined query.
8. Assess `demo/shop#7` to show a low-risk docs change.

Optional Coral validation:

```powershell
$env:CORAL_CONFIG_DIR = "E:\OneDrive\Desktop\Coral\.coral-config"
powershell -ExecutionPolicy Bypass -File .\scripts\install-demo-sources.ps1
npm run demo:coral
```

The Windows Coral CLI can live at `.tools/coral/coral.exe`; the app discovers it automatically or uses `CORAL_BIN` when set.
