/**
 * Headless-ish smoke: boot Electron, exercise DB + a short Playwright run, quit.
 * Usage: node scripts/smoke.mjs   (from ree-go/, after build)
 */
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const electronPath = createRequire(path.join(root, "package.json"))("electron");
const runner = path.join(root, "scripts", "smoke-main.cjs");

const child = spawn(electronPath, [runner], {
  cwd: root,
  env: {
    ...process.env,
    ELECTRON_DISABLE_SECURITY_WARNINGS: "1",
    REEGO_SMOKE: "1",
  },
  stdio: "inherit",
});

child.on("exit", (code) => process.exit(code ?? 1));
