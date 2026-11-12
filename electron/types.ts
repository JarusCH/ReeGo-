export type DeviceProfile = "desktop" | "mobile";

export type RunStatus = "passed" | "failed" | "running";

export interface Project {
  id: string;
  name: string;
  baseUrl: string;
  createdAt: string;
}

export interface Workflow {
  id: string;
  projectId: string;
  name: string;
  deviceProfile: DeviceProfile;
  scriptContent: string;
  createdAt: string;
  updatedAt: string;
}

export interface Locator {
  id: string;
  projectId: string;
  workflowId: string | null;
  key: string;
  selector: string;
  notes: string;
}

export interface TestStep {
  id: string;
  workflowId: string;
  stepOrder: number;
  description: string;
  actionType: string;
  locatorKey: string | null;
}

export interface Run {
  id: string;
  workflowId: string;
  status: RunStatus;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  errorSummary: string | null;
  deviceProfile: DeviceProfile;
}

export interface CapturedAction {
  type: "goto" | "click" | "fill" | "press" | "select" | "check" | "uncheck";
  url?: string;
  selector?: string;
  value?: string;
  key?: string;
  description: string;
  locatorKey?: string;
}

export interface RecordResult {
  actions: CapturedAction[];
  script: string;
  steps: Array<{ description: string; actionType: string; locatorKey: string | null }>;
  locators: Array<{ key: string; selector: string }>;
}
