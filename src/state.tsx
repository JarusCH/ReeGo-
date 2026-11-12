import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Project, Workflow } from "./types";

type Theme = "light" | "dark";

interface AppState {
  theme: Theme;
  toggleTheme: () => void;
  project: Project | null;
  setProject: (p: Project | null) => void;
  workflow: Workflow | null;
  setWorkflow: (w: Workflow | null) => void;
  refreshProject: (id: string) => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("ree-go-theme");
    return saved === "light" ? "light" : "dark";
  });
  const [project, setProject] = useState<Project | null>(null);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("ree-go-theme", theme);
  }, [theme]);

  useEffect(() => {
    const saved = localStorage.getItem("ree-go-project-id");
    if (!saved || !window.reeGo) return;
    void window.reeGo.projects.get(saved).then((p: Project | null) => {
      if (p) setProject(p);
    });
  }, []);

  useEffect(() => {
    if (project) localStorage.setItem("ree-go-project-id", project.id);
    else localStorage.removeItem("ree-go-project-id");
  }, [project]);

  const value: AppState = {
    theme,
    toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    project,
    setProject: (p) => {
      setProject(p);
      if (!p) setWorkflow(null);
    },
    workflow,
    setWorkflow,
    refreshProject: async (id: string) => {
      const p = await window.reeGo.projects.get(id);
      if (p) setProject(p);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp outside provider");
  return ctx;
}
