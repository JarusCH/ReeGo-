import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
} from "electron";
import path from "path";
import * as db from "./db";
import * as pw from "./playwright-service";
import type { DeviceProfile } from "./types";

// Linux desktops often lack a correctly owned chrome-sandbox binary.
// Disable the SUID sandbox so `npm run dev` can boot without root chmod.
if (process.platform === "linux") {
  app.commandLine.appendSwitch("no-sandbox");
  app.commandLine.appendSwitch("disable-setuid-sandbox");
}

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: "ReeGo",
    backgroundColor: "#0f1419",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void mainWindow.loadURL(devUrl);
    if (!app.isPackaged) {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function sendProgress(channel: string, payload: unknown): void {
  mainWindow?.webContents.send(channel, payload);
}

function registerIpc(): void {
  ipcMain.handle("projects:list", () => db.listProjects());
  ipcMain.handle("projects:get", (_e, id: string) => db.getProject(id));
  ipcMain.handle(
    "projects:create",
    (_e, name: string, baseUrl: string) => db.createProject(name, baseUrl)
  );
  ipcMain.handle("projects:delete", (_e, id: string) => {
    db.deleteProject(id);
    return true;
  });

  ipcMain.handle("workflows:list", (_e, projectId: string) =>
    db.listWorkflows(projectId)
  );
  ipcMain.handle("workflows:get", (_e, id: string) => db.getWorkflow(id));
  ipcMain.handle(
    "workflows:update",
    (
      _e,
      id: string,
      patch: Partial<{
        name: string;
        deviceProfile: DeviceProfile;
        scriptContent: string;
      }>
    ) => db.updateWorkflow(id, patch)
  );
  ipcMain.handle("workflows:steps", (_e, workflowId: string) =>
    db.listSteps(workflowId)
  );

  ipcMain.handle("locators:list", (_e, projectId: string) =>
    db.listLocators(projectId)
  );
  ipcMain.handle(
    "locators:upsert",
    (
      _e,
      input: {
        projectId: string;
        workflowId?: string | null;
        key: string;
        selector: string;
        notes?: string;
      }
    ) => db.upsertLocator(input)
  );
  ipcMain.handle(
    "locators:update",
    (
      _e,
      id: string,
      patch: Partial<{ key: string; selector: string; notes: string }>
    ) => db.updateLocator(id, patch)
  );
  ipcMain.handle("locators:delete", (_e, id: string) => {
    db.deleteLocator(id);
    return true;
  });

  ipcMain.handle("runs:list", (_e, projectId?: string) =>
    db.listRuns(projectId)
  );
  ipcMain.handle("runs:get", (_e, id: string) => db.getRun(id));

  ipcMain.handle(
    "studio:startRecord",
    async (
      _e,
      opts: { url: string; deviceProfile: DeviceProfile; projectId: string }
    ) => {
      await pw.startRecording({
        url: opts.url,
        deviceProfile: opts.deviceProfile,
        progress: (payload) => sendProgress("studio:progress", payload),
      });
      return { ok: true };
    }
  );

  ipcMain.handle(
    "studio:stopRecord",
    async (
      _e,
      opts: {
        projectId: string;
        name: string;
        deviceProfile: DeviceProfile;
      }
    ) => {
      const result = await pw.stopRecording();
      const workflow = db.createWorkflow({
        projectId: opts.projectId,
        name: opts.name || `Workflow ${new Date().toLocaleString()}`,
        deviceProfile: opts.deviceProfile,
        scriptContent: result.script,
      });
      db.replaceSteps(workflow.id, result.steps);
      db.seedLocators(opts.projectId, workflow.id, result.locators);
      return { workflow, result };
    }
  );

  ipcMain.handle(
    "studio:run",
    async (
      _e,
      opts: {
        workflowId: string;
        deviceProfile?: DeviceProfile;
      }
    ) => {
      const workflow = db.getWorkflow(opts.workflowId);
      if (!workflow) throw new Error("Workflow not found");
      const project = db.getProject(workflow.projectId);
      if (!project) throw new Error("Project not found");
      const deviceProfile = opts.deviceProfile || workflow.deviceProfile;
      const locators = db.listLocators(project.id);
      const run = db.createRun({ workflowId: workflow.id, deviceProfile });

      const outcome = await pw.runScript({
        scriptContent: workflow.scriptContent,
        baseUrl: project.baseUrl,
        deviceProfile,
        locators: locators.map((l) => ({ key: l.key, selector: l.selector })),
        progress: (payload) => sendProgress("studio:progress", payload),
      });

      const finished = db.finishRun(run.id, {
        status: outcome.ok ? "passed" : "failed",
        errorSummary: outcome.error ?? null,
      });
      return finished;
    }
  );

  ipcMain.handle("studio:isRecording", () => pw.isRecording());
}

app.whenReady().then(() => {
  db.initDb();
  registerIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  void pw.disposePlaywright();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  void pw.disposePlaywright();
});
