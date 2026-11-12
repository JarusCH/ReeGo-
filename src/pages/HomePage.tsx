import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../state";
import type { Project, Workflow } from "../types";

export default function HomePage() {
  const { project, setProject, setWorkflow } = useApp();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://example.com");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const list = await window.reeGo.projects.list();
    setProjects(list);
    if (project) {
      const ws = await window.reeGo.workflows.list(project.id);
      setWorkflows(ws);
    } else {
      setWorkflows([]);
    }
  }

  useEffect(() => {
    void refresh();
  }, [project?.id]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !baseUrl.trim()) return;
    setBusy(true);
    try {
      const created = await window.reeGo.projects.create(name.trim(), baseUrl.trim());
      setProject(created);
      setName("");
      await refresh();
      navigate("/studio");
    } finally {
      setBusy(false);
    }
  }

  async function openProject(p: Project) {
    setProject(p);
    setWorkflow(null);
    navigate("/studio");
  }

  async function removeProject(id: string) {
    if (!confirm("Delete this project and all workflows/runs?")) return;
    await window.reeGo.projects.delete(id);
    if (project?.id === id) {
      setProject(null);
      setWorkflow(null);
    }
    await refresh();
  }

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1>Projects</h1>
          <p>Create or open a web-game project, then record in Studio.</p>
        </div>
      </div>

      <form className="glass panel stack" onSubmit={onCreate}>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="name">Project name</label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Roulette smoke"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="url">Base URL</label>
            <input
              id="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://game.example.com"
              required
            />
          </div>
        </div>
        <div className="row">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            Create project
          </button>
        </div>
      </form>

      <section className="stack">
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Your projects</h2>
        {projects.length === 0 ? (
          <div className="glass empty">No projects yet — create one above.</div>
        ) : (
          <div className="project-list">
            {projects.map((p) => (
              <div key={p.id} className="glass project-card">
                <div onClick={() => void openProject(p)} role="button" tabIndex={0}>
                  <h3>{p.name}</h3>
                  <div className="mono muted">{p.baseUrl}</div>
                  <div className="muted" style={{ marginTop: 8, fontSize: "0.8rem" }}>
                    Created {new Date(p.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="row" style={{ marginTop: 12 }}>
                  <button className="btn btn-primary" type="button" onClick={() => void openProject(p)}>
                    Open
                  </button>
                  <button
                    className="btn btn-danger"
                    type="button"
                    onClick={() => void removeProject(p.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {project ? (
        <section className="glass panel stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 style={{ margin: 0, fontSize: "1.1rem" }}>
              Workflows in {project.name}
            </h2>
            <button className="btn" type="button" onClick={() => navigate("/studio")}>
              Open Studio
            </button>
          </div>
          {workflows.length === 0 ? (
            <div className="muted">No workflows yet. Record one in Studio.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Device</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {workflows.map((w) => (
                  <tr key={w.id}>
                    <td>{w.name}</td>
                    <td>
                      <span className="badge">{w.deviceProfile}</span>
                    </td>
                    <td className="muted">{new Date(w.updatedAt).toLocaleString()}</td>
                    <td>
                      <button
                        className="btn"
                        type="button"
                        onClick={() => {
                          setWorkflow(w);
                          navigate(`/workflow/${w.id}`);
                        }}
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : null}
    </div>
  );
}
