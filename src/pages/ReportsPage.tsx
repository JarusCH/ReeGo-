import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../state";
import type { Run } from "../types";

export default function ReportsPage() {
  const { project } = useApp();
  const [runs, setRuns] = useState<Run[]>([]);
  const [selected, setSelected] = useState<Run | null>(null);

  async function refresh() {
    const list = await window.reeGo.runs.list(project?.id);
    setRuns(list);
  }

  useEffect(() => {
    void refresh();
  }, [project?.id]);

  function formatDuration(ms: number | null | undefined) {
    if (ms == null) return "—";
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(1)} s`;
  }

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1>Reports</h1>
          <p>Pass/fail history for workflow runs.</p>
        </div>
        <button className="btn" type="button" onClick={() => void refresh()}>
          Refresh
        </button>
      </div>

      {!project ? (
        <div className="glass empty">
          Tip: open a project to filter runs. Showing all runs. <Link to="/">Projects</Link>
        </div>
      ) : null}

      <div className="glass panel">
        {runs.length === 0 ? (
          <div className="muted">
            No runs yet. Record a flow, then hit Run in <Link to="/studio">Studio</Link>.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Workflow</th>
                <th>Device</th>
                <th>Duration</th>
                <th>Started</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span
                      className={`badge ${
                        r.status === "passed" ? "pass" : r.status === "failed" ? "fail" : "run"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td>{r.workflowName || r.workflowId}</td>
                  <td>{r.deviceProfile}</td>
                  <td>{formatDuration(r.durationMs)}</td>
                  <td className="muted">{new Date(r.startedAt).toLocaleString()}</td>
                  <td>
                    <button className="btn" type="button" onClick={() => setSelected(r)}>
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected ? (
        <div className="glass panel stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Run details</h2>
            <button className="btn" type="button" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
          <div>
            <span
              className={`badge ${
                selected.status === "passed"
                  ? "pass"
                  : selected.status === "failed"
                    ? "fail"
                    : "run"
              }`}
            >
              {selected.status}
            </span>{" "}
            · {selected.workflowName} · {selected.deviceProfile}
          </div>
          <div className="muted">
            Started {new Date(selected.startedAt).toLocaleString()}
            {selected.finishedAt
              ? ` · Finished ${new Date(selected.finishedAt).toLocaleString()}`
              : ""}
            {selected.durationMs != null ? ` · ${formatDuration(selected.durationMs)}` : ""}
          </div>
          {selected.errorSummary ? (
            <pre
              className="mono"
              style={{
                whiteSpace: "pre-wrap",
                margin: 0,
                padding: 12,
                borderRadius: 12,
                background: "var(--glass-strong)",
                border: "1px solid var(--glass-border)",
              }}
            >
              {selected.errorSummary}
            </pre>
          ) : (
            <div className="muted">No error summary.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
