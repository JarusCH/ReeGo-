# ReeGo

Electron MVP for **web-game** workflow testing: record a browser flow with Playwright, save human-readable steps and locators, edit generated code in Monaco, replay on Desktop or Mobile viewport, and review pass/fail reports — all in one local app.

## Stack

- Electron + React + TypeScript
- Playwright (main process — record & run)
- Monaco editor
- SQLite (`better-sqlite3`) for local persistence
- Glassmorphism UI with light/dark themes

## Setup

```bash
cd ree-go
npm install
```

`postinstall` installs Playwright Chromium. Native module rebuild for Electron happens via `@electron/rebuild` when needed:

```bash
npx electron-rebuild -f -w better-sqlite3
```

## Run (development)

```bash
npm run dev
```

This starts the Vite renderer on `http://127.0.0.1:5173` and launches Electron against it.

## Run (production build)

```bash
npm start
```

Builds renderer + main process, then opens Electron loading the built UI.

## Demo: record once, replay

1. **Projects** → create a project with a name and base URL (any public web page or game URL).
2. **Studio** → confirm URL, pick **Desktop** or **Mobile**, click **Record**.
3. Interact in the Playwright Chromium window (clicks, fills, navigations are captured). Preview screenshots stream into Studio.
4. Click **Stop**, optionally set a workflow name. ReeGo saves:
   - workflow + generated Playwright script
   - human-readable test steps
   - seeded locator key → selector entries
5. Review steps on **Workflow**, tweak selectors on **Locators**, optionally edit delays/conditions on **Code** (Save).
6. Back in **Studio**, select the workflow and click **Run** (same or other device profile).
7. Open **Reports** for pass/fail, duration, and timestamp (failed runs show error details).

## App layout

| Screen | Role |
|--------|------|
| Projects | Create/open projects (SQLite) |
| Studio | URL, device profile, record / stop / run |
| Workflow | Steps linked to the recorded flow |
| Locators | CRUD key → selector |
| Code | Monaco load/edit/save script |
| Reports | Run history |

## Out of scope (MVP)

CPU monitor, multi-user/cloud auth, native/mobile-app automation.

## Repo note

This app lives under `ree-go/` because the repository root already hosts the Signal Desk Next.js project.
