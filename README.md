# ReeGo

Electron MVP for **web-game** workflow testing: record a browser flow with Playwright, save human-readable steps and locators, edit generated code in Monaco, replay on Desktop or Mobile viewport, and review pass/fail reports — all in one local app.

## Stack

- Electron + React + TypeScript
- Playwright (main process — record & run)
- Monaco editor
- SQLite (`better-sqlite3`) for local persistence
- Glassmorphism UI with light/dark themes

## Requirements

- **Node.js 20+** (Node 18 will show `EBADENGINE` / Playwright warnings and may fail)
- npm 10+ recommended
- Linux desktop with a display (Electron GUI)

### Install Node 20 (if `nvm` is not installed)

```bash
# Option A — NodeSource (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # expect v20.x

# Option B — official binary from https://nodejs.org (LTS 20+)
```

## Setup

```bash
git clone https://github.com/JarusCH/ReeGo-.git
cd ReeGo-
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

### Linux: chrome-sandbox / SUID error

If Electron aborts with `The SUID sandbox helper binary was found, but is not configured correctly`, pull the latest `main` (scripts already pass `--no-sandbox`) or run:

```bash
ELECTRON_DISABLE_SANDBOX=1 npx electron . --no-sandbox
```

Optional root fix instead:

```bash
sudo chown root:root node_modules/electron/dist/chrome-sandbox
sudo chmod 4755 node_modules/electron/dist/chrome-sandbox
```

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
