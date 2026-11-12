import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useApp } from "./state";
import HomePage from "./pages/HomePage";
import StudioPage from "./pages/StudioPage";
import WorkflowPage from "./pages/WorkflowPage";
import LocatorsPage from "./pages/LocatorsPage";
import CodePage from "./pages/CodePage";
import ReportsPage from "./pages/ReportsPage";

const links = [
  { to: "/", label: "Projects", end: true },
  { to: "/studio", label: "Studio" },
  { to: "/workflow", label: "Workflow" },
  { to: "/locators", label: "Locators" },
  { to: "/code", label: "Code" },
  { to: "/reports", label: "Reports" },
];

export default function App() {
  const { theme, toggleTheme, project } = useApp();

  return (
    <div className="app-shell">
      <aside className="nav">
        <div className="brand">
          <div className="brand-mark">ReeGo</div>
          <div className="brand-sub">Web-game workflow studio</div>
        </div>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) => (isActive ? "active" : undefined)}
          >
            {l.label}
          </NavLink>
        ))}
        <div className="nav-footer stack">
          {project ? (
            <div className="muted" style={{ fontSize: "0.8rem", padding: "0 8px" }}>
              Open: <strong style={{ color: "var(--text)" }}>{project.name}</strong>
            </div>
          ) : null}
          <button className="btn btn-ghost" onClick={toggleTheme} type="button">
            {theme === "dark" ? "Light theme" : "Dark theme"}
          </button>
        </div>
      </aside>
      <main className="main fade-in">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/studio" element={<StudioPage />} />
          <Route path="/workflow" element={<WorkflowPage />} />
          <Route path="/workflow/:id" element={<WorkflowPage />} />
          <Route path="/locators" element={<LocatorsPage />} />
          <Route path="/code" element={<CodePage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
