import { contextBridge, ipcRenderer } from "electron";
import type { DeviceProfile } from "./types";

export type StudioProgress = {
  kind: "status" | "action" | "screenshot" | "error";
  message?: string;
  action?: unknown;
  screenshot?: string;
};

const api = {
  projects: {
    list: () => ipcRenderer.invoke("projects:list"),
    get: (id: string) => ipcRenderer.invoke("projects:get", id),
    create: (name: string, baseUrl: string) =>
      ipcRenderer.invoke("projects:create", name, baseUrl),
    delete: (id: string) => ipcRenderer.invoke("projects:delete", id),
  },
  workflows: {
    list: (projectId: string) =>
      ipcRenderer.invoke("workflows:list", projectId),
    get: (id: string) => ipcRenderer.invoke("workflows:get", id),
    update: (
      id: string,
      patch: Partial<{
        name: string;
        deviceProfile: DeviceProfile;
        scriptContent: string;
      }>
    ) => ipcRenderer.invoke("workflows:update", id, patch),
    steps: (workflowId: string) =>
      ipcRenderer.invoke("workflows:steps", workflowId),
  },
  locators: {
    list: (projectId: string) =>
      ipcRenderer.invoke("locators:list", projectId),
    upsert: (input: {
      projectId: string;
      workflowId?: string | null;
      key: string;
      selector: string;
      notes?: string;
    }) => ipcRenderer.invoke("locators:upsert", input),
    update: (
      id: string,
      patch: Partial<{ key: string; selector: string; notes: string }>
    ) => ipcRenderer.invoke("locators:update", id, patch),
    delete: (id: string) => ipcRenderer.invoke("locators:delete", id),
  },
  runs: {
    list: (projectId?: string) => ipcRenderer.invoke("runs:list", projectId),
    get: (id: string) => ipcRenderer.invoke("runs:get", id),
  },
  studio: {
    startRecord: (opts: {
      url: string;
      deviceProfile: DeviceProfile;
      projectId: string;
    }) => ipcRenderer.invoke("studio:startRecord", opts),
    stopRecord: (opts: {
      projectId: string;
      name: string;
      deviceProfile: DeviceProfile;
    }) => ipcRenderer.invoke("studio:stopRecord", opts),
    run: (opts: { workflowId: string; deviceProfile?: DeviceProfile }) =>
      ipcRenderer.invoke("studio:run", opts),
    isRecording: () => ipcRenderer.invoke("studio:isRecording"),
    onProgress: (handler: (payload: StudioProgress) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: StudioProgress) =>
        handler(payload);
      ipcRenderer.on("studio:progress", listener);
      return () => {
        ipcRenderer.removeListener("studio:progress", listener);
      };
    },
  },
};

contextBridge.exposeInMainWorld("reeGo", api);

export type ReeGoApi = typeof api;
