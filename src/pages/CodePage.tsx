import Editor from "@monaco-editor/react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../state";
import type { Workflow } from "../types";

export default function CodePage() {
  const { project, workflow, setWorkflow, theme } = useApp();
  const [list, setList] = useState<Workflow[]>([]);
  const [selectedId, setSelectedId] = useState(workflow?.id ?? "");
  const [code, setCode] = useState(workflow?.scriptContent ?? "");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!project) return;
    void window.reeGo.workflows.list(project.id).then((ws) => {
      setList(ws);
      if (!selectedId && ws[0]) {
        setSelectedId(ws[0].id);
      }
    });
  }, [project?.id]);

  useEffect(() => {
    if (!selectedId) return;
    void window.reeGo.workflows.get(selectedId).then((w) => {
      if (!w) return;
      setWorkflow(w);
      setCode(w.scriptContent);
    });
  }, [selectedId]);

  if (!project) {
    return (
      <div className="glass empty">
        Open a project first. <Link to="/">Projects</Link>
      </div>
    );
  }

  async function save() {
    if (!selectedId) return;
    const updated = await window.reeGo.workflows.update(selectedId, {
      scriptContent: code,
    });
    setWorkflow(updated);
    setStatus(`Saved at ${new Date().toLocaleTimeString()}`);
  }

  return (
    <div className="stack" style={{ height: "calc(100vh - 80px)" }}>
      <div className="page-header">
        <div>
          <h1>Code</h1>
          <p>
            Edit the generated Playwright script. Add delays or conditions by hand, then save.
          </p>
        </div>
        <div className="row">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            style={{
              background: "var(--glass-strong)",
              border: "1px solid var(--glass-border)",
              borderRadius: 12,
              padding: "9px 12px",
            }}
          >
            <option value="">Select workflow…</option>
            {list.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" type="button" onClick={() => void save()} disabled={!selectedId}>
            Save
          </button>
        </div>
      </div>

      {!selectedId ? (
        <div className="glass empty">
          Record a workflow in <Link to="/studio">Studio</Link> first.
        </div>
      ) : (
        <div className="glass" style={{ flex: 1, overflow: "hidden", minHeight: 480 }}>
          <Editor
            height="100%"
            defaultLanguage="typescript"
            theme={theme === "dark" ? "vs-dark" : "light"}
            value={code}
            onChange={(v) => setCode(v ?? "")}
            options={{
              fontSize: 13,
              minimap: { enabled: false },
              wordWrap: "on",
              automaticLayout: true,
              scrollBeyondLastLine: false,
            }}
          />
        </div>
      )}
      {status ? <div className="muted">{status}</div> : null}
    </div>
  );
}
