import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useApp } from "../state";
import type { TestStep, Workflow } from "../types";

export default function WorkflowPage() {
  const { id } = useParams();
  const { project, workflow, setWorkflow } = useApp();
  const navigate = useNavigate();
  const [current, setCurrent] = useState<Workflow | null>(workflow);
  const [steps, setSteps] = useState<TestStep[]>([]);
  const [list, setList] = useState<Workflow[]>([]);

  useEffect(() => {
    if (!project) return;
    void window.reeGo.workflows.list(project.id).then(setList);
  }, [project?.id]);

  useEffect(() => {
    const targetId = id || workflow?.id;
    if (!targetId) return;
    void (async () => {
      const w = await window.reeGo.workflows.get(targetId);
      if (w) {
        setCurrent(w);
        setWorkflow(w);
        const s = await window.reeGo.workflows.steps(w.id);
        setSteps(s);
      }
    })();
  }, [id, workflow?.id]);

  if (!project) {
    return (
      <div className="glass empty">
        Open a project first. <Link to="/">Projects</Link>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="stack">
        <div className="page-header">
          <div>
            <h1>Workflow</h1>
            <p>Pick a recorded workflow to review steps and locators.</p>
          </div>
        </div>
        {list.length === 0 ? (
          <div className="glass empty">
            No workflows yet. <Link to="/studio">Record in Studio</Link>
          </div>
        ) : (
          <div className="glass panel">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Device</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((w) => (
                  <tr key={w.id}>
                    <td>{w.name}</td>
                    <td>{w.deviceProfile}</td>
                    <td>
                      <button
                        className="btn"
                        type="button"
                        onClick={() => navigate(`/workflow/${w.id}`)}
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1>{current.name}</h1>
          <p>
            Device <span className="badge">{current.deviceProfile}</span> · Updated{" "}
            {new Date(current.updatedAt).toLocaleString()}
          </p>
        </div>
        <div className="row">
          <button className="btn" type="button" onClick={() => navigate("/code")}>
            Open code
          </button>
          <button className="btn" type="button" onClick={() => navigate("/locators")}>
            Locators
          </button>
          <button className="btn btn-primary" type="button" onClick={() => navigate("/studio")}>
            Studio / Run
          </button>
        </div>
      </div>

      <div className="glass panel">
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Test steps</h2>
        {steps.length === 0 ? (
          <div className="muted">No steps captured.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Description</th>
                <th>Action</th>
                <th>Locator key</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((s) => (
                <tr key={s.id}>
                  <td>{s.stepOrder}</td>
                  <td>{s.description}</td>
                  <td>
                    <span className="badge">{s.actionType}</span>
                  </td>
                  <td className="mono">{s.locatorKey || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
