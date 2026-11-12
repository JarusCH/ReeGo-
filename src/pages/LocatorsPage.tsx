import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../state";
import type { Locator } from "../types";

export default function LocatorsPage() {
  const { project } = useApp();
  const [rows, setRows] = useState<Locator[]>([]);
  const [key, setKey] = useState("");
  const [selector, setSelector] = useState("");
  const [notes, setNotes] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  async function refresh() {
    if (!project) return;
    setRows(await window.reeGo.locators.list(project.id));
  }

  useEffect(() => {
    void refresh();
  }, [project?.id]);

  if (!project) {
    return (
      <div className="glass empty">
        Open a project first. <Link to="/">Projects</Link>
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!key.trim() || !selector.trim()) return;
    if (editingId) {
      await window.reeGo.locators.update(editingId, {
        key: key.trim(),
        selector: selector.trim(),
        notes: notes.trim(),
      });
    } else {
      await window.reeGo.locators.upsert({
        projectId: project!.id,
        key: key.trim(),
        selector: selector.trim(),
        notes: notes.trim(),
      });
    }
    setKey("");
    setSelector("");
    setNotes("");
    setEditingId(null);
    await refresh();
  }

  function startEdit(row: Locator) {
    setEditingId(row.id);
    setKey(row.key);
    setSelector(row.selector);
    setNotes(row.notes);
  }

  async function remove(id: string) {
    if (!confirm("Delete this locator?")) return;
    await window.reeGo.locators.delete(id);
    await refresh();
  }

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1>Locators</h1>
          <p>Key → selector map. Edits apply on the next run.</p>
        </div>
      </div>

      <form className="glass panel stack" onSubmit={onSubmit}>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="lokey">Key</label>
            <input
              id="lokey"
              className="mono"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="spin_button"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="losel">Selector</label>
            <input
              id="losel"
              className="mono"
              value={selector}
              onChange={(e) => setSelector(e.target.value)}
              placeholder="#spin-btn"
              required
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="lonotes">Notes</label>
          <input
            id="lonotes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div className="row">
          <button className="btn btn-primary" type="submit">
            {editingId ? "Save locator" : "Add locator"}
          </button>
          {editingId ? (
            <button
              className="btn"
              type="button"
              onClick={() => {
                setEditingId(null);
                setKey("");
                setSelector("");
                setNotes("");
              }}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      <div className="glass panel">
        {rows.length === 0 ? (
          <div className="muted">No locators yet — they seed automatically after a recording.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Selector</th>
                <th>Notes</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.key}</td>
                  <td className="mono">{r.selector}</td>
                  <td className="muted">{r.notes || "—"}</td>
                  <td>
                    <div className="row">
                      <button className="btn" type="button" onClick={() => startEdit(r)}>
                        Edit
                      </button>
                      <button
                        className="btn btn-danger"
                        type="button"
                        onClick={() => void remove(r.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
