import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { app } from "electron";
import { v4 as uuid } from "uuid";
import type {
  DeviceProfile,
  Locator,
  Project,
  Run,
  RunStatus,
  TestStep,
  Workflow,
} from "./types";

let db: Database.Database | null = null;

function dbPath(): string {
  const dir = path.join(app.getPath("userData"), "ree-go");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "ree-go.sqlite");
}

export function initDb(): void {
  db = new Database(dbPath());
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      baseUrl TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      name TEXT NOT NULL,
      deviceProfile TEXT NOT NULL,
      scriptContent TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY(projectId) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS locators (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      workflowId TEXT,
      key TEXT NOT NULL,
      selector TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      FOREIGN KEY(projectId) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS test_steps (
      id TEXT PRIMARY KEY,
      workflowId TEXT NOT NULL,
      stepOrder INTEGER NOT NULL,
      description TEXT NOT NULL,
      actionType TEXT NOT NULL,
      locatorKey TEXT,
      FOREIGN KEY(workflowId) REFERENCES workflows(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      workflowId TEXT NOT NULL,
      status TEXT NOT NULL,
      startedAt TEXT NOT NULL,
      finishedAt TEXT,
      durationMs INTEGER,
      errorSummary TEXT,
      deviceProfile TEXT NOT NULL,
      FOREIGN KEY(workflowId) REFERENCES workflows(id) ON DELETE CASCADE
    );
  `);
}

function requireDb(): Database.Database {
  if (!db) throw new Error("Database not initialized");
  return db;
}

export function listProjects(): Project[] {
  return requireDb()
    .prepare("SELECT * FROM projects ORDER BY createdAt DESC")
    .all() as Project[];
}

export function getProject(id: string): Project | undefined {
  return requireDb().prepare("SELECT * FROM projects WHERE id = ?").get(id) as
    | Project
    | undefined;
}

export function createProject(name: string, baseUrl: string): Project {
  const project: Project = {
    id: uuid(),
    name: name.trim(),
    baseUrl: baseUrl.trim(),
    createdAt: new Date().toISOString(),
  };
  requireDb()
    .prepare(
      "INSERT INTO projects (id, name, baseUrl, createdAt) VALUES (@id, @name, @baseUrl, @createdAt)"
    )
    .run(project);
  return project;
}

export function deleteProject(id: string): void {
  const d = requireDb();
  const workflows = d
    .prepare("SELECT id FROM workflows WHERE projectId = ?")
    .all(id) as Array<{ id: string }>;
  const delSteps = d.prepare("DELETE FROM test_steps WHERE workflowId = ?");
  const delRuns = d.prepare("DELETE FROM runs WHERE workflowId = ?");
  for (const w of workflows) {
    delSteps.run(w.id);
    delRuns.run(w.id);
  }
  d.prepare("DELETE FROM locators WHERE projectId = ?").run(id);
  d.prepare("DELETE FROM workflows WHERE projectId = ?").run(id);
  d.prepare("DELETE FROM projects WHERE id = ?").run(id);
}

export function listWorkflows(projectId: string): Workflow[] {
  return requireDb()
    .prepare(
      "SELECT * FROM workflows WHERE projectId = ? ORDER BY updatedAt DESC"
    )
    .all(projectId) as Workflow[];
}

export function getWorkflow(id: string): Workflow | undefined {
  return requireDb().prepare("SELECT * FROM workflows WHERE id = ?").get(id) as
    | Workflow
    | undefined;
}

export function createWorkflow(input: {
  projectId: string;
  name: string;
  deviceProfile: DeviceProfile;
  scriptContent: string;
}): Workflow {
  const now = new Date().toISOString();
  const workflow: Workflow = {
    id: uuid(),
    projectId: input.projectId,
    name: input.name,
    deviceProfile: input.deviceProfile,
    scriptContent: input.scriptContent,
    createdAt: now,
    updatedAt: now,
  };
  requireDb()
    .prepare(
      `INSERT INTO workflows (id, projectId, name, deviceProfile, scriptContent, createdAt, updatedAt)
       VALUES (@id, @projectId, @name, @deviceProfile, @scriptContent, @createdAt, @updatedAt)`
    )
    .run(workflow);
  return workflow;
}

export function updateWorkflow(
  id: string,
  patch: Partial<Pick<Workflow, "name" | "deviceProfile" | "scriptContent">>
): Workflow {
  const existing = getWorkflow(id);
  if (!existing) throw new Error("Workflow not found");
  const updated: Workflow = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  requireDb()
    .prepare(
      `UPDATE workflows SET name = @name, deviceProfile = @deviceProfile,
       scriptContent = @scriptContent, updatedAt = @updatedAt WHERE id = @id`
    )
    .run(updated);
  return updated;
}

export function replaceSteps(
  workflowId: string,
  steps: Array<{
    description: string;
    actionType: string;
    locatorKey: string | null;
  }>
): TestStep[] {
  const d = requireDb();
  d.prepare("DELETE FROM test_steps WHERE workflowId = ?").run(workflowId);
  const insert = d.prepare(
    `INSERT INTO test_steps (id, workflowId, stepOrder, description, actionType, locatorKey)
     VALUES (@id, @workflowId, @stepOrder, @description, @actionType, @locatorKey)`
  );
  const rows: TestStep[] = steps.map((s, i) => ({
    id: uuid(),
    workflowId,
    stepOrder: i + 1,
    description: s.description,
    actionType: s.actionType,
    locatorKey: s.locatorKey,
  }));
  const tx = d.transaction((items: TestStep[]) => {
    for (const row of items) insert.run(row);
  });
  tx(rows);
  return rows;
}

export function listSteps(workflowId: string): TestStep[] {
  return requireDb()
    .prepare(
      "SELECT * FROM test_steps WHERE workflowId = ? ORDER BY stepOrder ASC"
    )
    .all(workflowId) as TestStep[];
}

export function listLocators(projectId: string): Locator[] {
  return requireDb()
    .prepare(
      "SELECT * FROM locators WHERE projectId = ? ORDER BY key COLLATE NOCASE ASC"
    )
    .all(projectId) as Locator[];
}

export function upsertLocator(input: {
  projectId: string;
  workflowId?: string | null;
  key: string;
  selector: string;
  notes?: string;
}): Locator {
  const d = requireDb();
  const existing = d
    .prepare("SELECT * FROM locators WHERE projectId = ? AND key = ?")
    .get(input.projectId, input.key) as Locator | undefined;
  if (existing) {
    const updated: Locator = {
      ...existing,
      selector: input.selector,
      notes: input.notes ?? existing.notes,
      workflowId: input.workflowId ?? existing.workflowId,
    };
    d.prepare(
      `UPDATE locators SET selector = @selector, notes = @notes, workflowId = @workflowId
       WHERE id = @id`
    ).run(updated);
    return updated;
  }
  const locator: Locator = {
    id: uuid(),
    projectId: input.projectId,
    workflowId: input.workflowId ?? null,
    key: input.key,
    selector: input.selector,
    notes: input.notes ?? "",
  };
  d.prepare(
    `INSERT INTO locators (id, projectId, workflowId, key, selector, notes)
     VALUES (@id, @projectId, @workflowId, @key, @selector, @notes)`
  ).run(locator);
  return locator;
}

export function updateLocator(
  id: string,
  patch: Partial<Pick<Locator, "key" | "selector" | "notes">>
): Locator {
  const d = requireDb();
  const existing = d.prepare("SELECT * FROM locators WHERE id = ?").get(id) as
    | Locator
    | undefined;
  if (!existing) throw new Error("Locator not found");
  const updated = { ...existing, ...patch };
  d.prepare(
    `UPDATE locators SET key = @key, selector = @selector, notes = @notes WHERE id = @id`
  ).run(updated);
  return updated;
}

export function deleteLocator(id: string): void {
  requireDb().prepare("DELETE FROM locators WHERE id = ?").run(id);
}

export function createRun(input: {
  workflowId: string;
  deviceProfile: DeviceProfile;
}): Run {
  const run: Run = {
    id: uuid(),
    workflowId: input.workflowId,
    status: "running",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    durationMs: null,
    errorSummary: null,
    deviceProfile: input.deviceProfile,
  };
  requireDb()
    .prepare(
      `INSERT INTO runs (id, workflowId, status, startedAt, finishedAt, durationMs, errorSummary, deviceProfile)
       VALUES (@id, @workflowId, @status, @startedAt, @finishedAt, @durationMs, @errorSummary, @deviceProfile)`
    )
    .run(run);
  return run;
}

export function finishRun(
  id: string,
  result: {
    status: Exclude<RunStatus, "running">;
    errorSummary?: string | null;
  }
): Run {
  const d = requireDb();
  const existing = d.prepare("SELECT * FROM runs WHERE id = ?").get(id) as
    | Run
    | undefined;
  if (!existing) throw new Error("Run not found");
  const finishedAt = new Date().toISOString();
  const durationMs =
    new Date(finishedAt).getTime() - new Date(existing.startedAt).getTime();
  const updated: Run = {
    ...existing,
    status: result.status,
    finishedAt,
    durationMs,
    errorSummary: result.errorSummary ?? null,
  };
  d.prepare(
    `UPDATE runs SET status = @status, finishedAt = @finishedAt, durationMs = @durationMs,
     errorSummary = @errorSummary WHERE id = @id`
  ).run(updated);
  return updated;
}

export function listRuns(projectId?: string): Array<
  Run & { workflowName: string; projectId: string }
> {
  if (projectId) {
    return requireDb()
      .prepare(
        `SELECT r.*, w.name AS workflowName, w.projectId AS projectId
         FROM runs r
         JOIN workflows w ON w.id = r.workflowId
         WHERE w.projectId = ?
         ORDER BY r.startedAt DESC`
      )
      .all(projectId) as Array<Run & { workflowName: string; projectId: string }>;
  }
  return requireDb()
    .prepare(
      `SELECT r.*, w.name AS workflowName, w.projectId AS projectId
       FROM runs r
       JOIN workflows w ON w.id = r.workflowId
       ORDER BY r.startedAt DESC`
    )
    .all() as Array<Run & { workflowName: string; projectId: string }>;
}

export function getRun(id: string): (Run & { workflowName: string }) | undefined {
  return requireDb()
    .prepare(
      `SELECT r.*, w.name AS workflowName
       FROM runs r JOIN workflows w ON w.id = r.workflowId WHERE r.id = ?`
    )
    .get(id) as (Run & { workflowName: string }) | undefined;
}

export function seedLocators(
  projectId: string,
  workflowId: string,
  entries: Array<{ key: string; selector: string }>
): Locator[] {
  return entries.map((e) =>
    upsertLocator({
      projectId,
      workflowId,
      key: e.key,
      selector: e.selector,
      notes: "Seeded from recording",
    })
  );
}
