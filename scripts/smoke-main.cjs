const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

async function run() {
  const db = require("../dist-electron/db");
  const pw = require("../dist-electron/playwright-service");

  db.initDb();
  const project = db.createProject("Smoke Project", "https://example.com");
  console.log("[smoke] project", project.id);

  const script = pw.generateScript([
    {
      type: "goto",
      url: "https://example.com",
      description: "Open example.com",
    },
  ]);

  const workflow = db.createWorkflow({
    projectId: project.id,
    name: "Example open",
    deviceProfile: "desktop",
    scriptContent: script,
  });
  db.replaceSteps(workflow.id, [
    { description: "Open example.com", actionType: "goto", locatorKey: null },
  ]);
  console.log("[smoke] workflow", workflow.id);

  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, "../dist-electron/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  await win.loadFile(path.join(__dirname, "../dist/index.html"));
  await new Promise((r) => setTimeout(r, 1500));

  const shotDir =
    process.env.REEGO_SHOT_DIR ||
    "/cursor/stores/bc-8c0d32cd-c1b0-4281-8092-dc1a8b4fa302/media/ree-go-mvp";
  fs.mkdirSync(shotDir, { recursive: true });
  const img = await win.webContents.capturePage();
  const shotPath = path.join(shotDir, "home-projects.png");
  fs.writeFileSync(shotPath, img.toPNG());
  console.log("[smoke] screenshot", shotPath);

  const outcome = await pw.runScript({
    scriptContent: workflow.scriptContent,
    baseUrl: project.baseUrl,
    deviceProfile: "desktop",
    locators: [],
    progress: (p) => console.log("[smoke:pw]", p.kind, p.message || ""),
  });
  console.log("[smoke] run", outcome);

  const run = db.createRun({ workflowId: workflow.id, deviceProfile: "desktop" });
  const finished = db.finishRun(run.id, {
    status: outcome.ok ? "passed" : "failed",
    errorSummary: outcome.error || null,
  });
  console.log("[smoke] persisted run", finished.status, finished.durationMs);

  await pw.disposePlaywright();
  app.exit(outcome.ok ? 0 : 1);
}

app.whenReady().then(() => {
  run().catch((err) => {
    console.error("[smoke] failed", err);
    app.exit(1);
  });
});
