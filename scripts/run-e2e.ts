import { spawn } from "node:child_process";
import { startServer } from "../apps/web/src/server.js";

const server = await startServer();

try {
  const code = await new Promise<number>((resolve) => {
    const child = spawn(
      process.execPath,
      ["node_modules/playwright/cli.js", "test", ...process.argv.slice(2)],
      {
        stdio: "inherit",
        shell: false,
        windowsHide: true
      }
    );
    child.on("close", (exitCode) => resolve(exitCode ?? 1));
    child.on("error", () => resolve(1));
  });
  process.exitCode = code;
} finally {
  await server.close();
}
