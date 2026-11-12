import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../state";
import type { DeviceProfile, Workflow } from "../types";

export default function StudioPage() {
  const { project, setWorkflow, workflow } = useApp();
  const navigate = useNavigate();
  const [url, setUrl] = useState(project?.baseUrl ?? "");
  const [device, setDevice] = useState<DeviceProfile>("desktop");
  const [recording, setRecording] = useState(false);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState("");
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedId, setSelectedId] = useState(workflow?.id ?? "");

  useEffect(() => {
    if (project) setUrl(project.baseUrl);
  }, [project?.id, project?.baseUrl]);

  useEffect(() => {
    if (!project) return;
    void window.reeGo.workflows.list(project.id).then(setWorkflows);
  }, [project?.id, workflow?.id]);

  useEffect(() => {
    if (!window.reeGo) return;
    const off = window.reeGo.studio.onProgress((payload) => {
      if (payload.message) setStatus(payload.message);
      if (payload.screenshot) setScreenshot(payload.screenshot);
      if (payload.kind === "error" && payload.message) setStatus(payload.message);
    });
    return () => {
      off();
    };
  }, []);

  if (!project) {
    return (
      <div className="glass empty">
        Open or create a project first.
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-primary" type="button" onClick={() => navigate("/")}>
            Go to Projects
          </button>
        </div>
      </div>
    );
  }

  async function startRecord() {
    if (!url.trim()) return;
    setRecording(true);
    setStatus("Starting recorder…");
    try {
      await window.reeGo.studio.startRecord({
        url: url.trim(),
        deviceProfile: device,
        projectId: project!.id,
      });
    } catch (err) {
      setRecording(false);
      setStatus(err instanceof Error ? err.message : String(err));
    }
  }

  async function stopRecord() {
    setStatus("Stopping and saving…");
    try {
      const { workflow: saved } = await window.reeGo.studio.stopRecord({
        projectId: project!.id,
        name: workflowName.trim() || `Flow ${new Date().toLocaleString()}`,
        deviceProfile: device,
      });
      setRecording(false);
      setWorkflow(saved);
      setSelectedId(saved.id);
      setStatus(`Saved workflow “${saved.name}”`);
      const list = await window.reeGo.workflows.list(project!.id);
      setWorkflows(list);
      navigate(`/workflow/${saved.id}`);
    } catch (err) {
      setRecording(false);
      setStatus(err instanceof Error ? err.message : String(err));
    }
  }

  async function runSelected() {
    const id = selectedId || workflow?.id;
    if (!id) {
      setStatus("Select or record a workflow first");
      return;
    }
    setRunning(true);
    setStatus("Running…");
    try {
      const result = await window.reeGo.studio.run({
        workflowId: id,
        deviceProfile: device,
      });
      setStatus(
        result.status === "passed"
          ? `Passed in ${result.durationMs}ms`
          : `Failed: ${result.errorSummary || "unknown error"}`
      );
      navigate("/reports");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="studio-layout">
      <div className="page-header">
        <div>
          <h1>Studio</h1>
          <p>
            Record a flow in the Playwright window, then stop to save steps and locators.
          </p>
        </div>
      </div>

      <div className="glass studio-toolbar">
        <div className="field">
          <label htmlFor="studio-url">URL</label>
          <input
            id="studio-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={recording || running}
          />
        </div>
        <div className="field">
          <label>Device profile</label>
          <div className="device-toggle">
            <button
              type="button"
              className={device === "desktop" ? "active" : undefined}
              onClick={() => setDevice("desktop")}
              disabled={recording || running}
            >
              Desktop
            </button>
            <button
              type="button"
              className={device === "mobile" ? "active" : undefined}
              onClick={() => setDevice("mobile")}
              disabled={recording || running}
            >
              Mobile
            </button>
          </div>
        </div>
        <div className="row">
          {!recording ? (
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => void startRecord()}
              disabled={running}
            >
              Record
            </button>
          ) : (
            <button className="btn btn-danger" type="button" onClick={() => void stopRecord()}>
              Stop
            </button>
          )}
          <button
            className="btn"
            type="button"
            onClick={() => void runSelected()}
            disabled={recording || running}
          >
            Run
          </button>
        </div>
      </div>

      <div className="glass preview-pane">
        {screenshot ? (
          <img src={screenshot} alt="Live preview from Playwright" />
        ) : (
          <div className="preview-empty">
            <div style={{ fontSize: "1.2rem", marginBottom: 8, color: "var(--text)" }}>
              Preview
            </div>
            Start recording to open a Playwright browser. Screenshots stream here while you
            interact.
          </div>
        )}
      </div>

      <div className="glass status-bar">
        <div>
          <div className="muted" style={{ fontSize: "0.75rem" }}>
            Status
          </div>
          <div>{status}</div>
        </div>
        <div className="row">
          <div className="field" style={{ minWidth: 180 }}>
            <label htmlFor="wf-name">Workflow name (on stop)</label>
            <input
              id="wf-name"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              placeholder="Login smoke"
              disabled={running}
            />
          </div>
          <div className="field" style={{ minWidth: 200 }}>
            <label htmlFor="wf-select">Run workflow</label>
            <select
              id="wf-select"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={recording || running}
            >
              <option value="">Select…</option>
              {workflows.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
