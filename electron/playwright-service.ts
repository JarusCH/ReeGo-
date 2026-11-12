import {
  chromium,
  devices,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import type {
  CapturedAction,
  DeviceProfile,
  RecordResult,
} from "./types";

export interface RecorderState {
  recording: boolean;
  url: string;
  deviceProfile: DeviceProfile;
  actions: CapturedAction[];
}

type ProgressCallback = (payload: {
  kind: "status" | "action" | "screenshot" | "error";
  message?: string;
  action?: CapturedAction;
  screenshot?: string;
}) => void;

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;
let recording = false;
let actions: CapturedAction[] = [];
let locatorCounter = 0;
const selectorToKey = new Map<string, string>();
let onProgress: ProgressCallback | null = null;
let screenshotTimer: NodeJS.Timeout | null = null;

function deviceOptions(profile: DeviceProfile) {
  if (profile === "mobile") {
    const pixel = devices["Pixel 7"];
    return {
      ...pixel,
      viewport: pixel.viewport,
    };
  }
  return {
    viewport: { width: 1280, height: 800 },
    userAgent: undefined as string | undefined,
    isMobile: false,
    hasTouch: false,
  };
}

function keyForSelector(selector: string, hint: string): string {
  const existing = selectorToKey.get(selector);
  if (existing) return existing;
  locatorCounter += 1;
  const base = hint
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 32);
  const key = `${base || "el"}_${locatorCounter}`;
  selectorToKey.set(selector, key);
  return key;
}

function pushAction(action: CapturedAction): void {
  actions.push(action);
  onProgress?.({ kind: "action", action, message: action.description });
}

async function captureScreenshot(): Promise<void> {
  if (!page || page.isClosed()) return;
  try {
    const buf = await page.screenshot({ type: "jpeg", quality: 55 });
    onProgress?.({
      kind: "screenshot",
      screenshot: `data:image/jpeg;base64,${buf.toString("base64")}`,
    });
  } catch {
    /* ignore transient screenshot errors */
  }
}

async function attachCapture(p: Page): Promise<void> {
  await p.exposeFunction("__reeGoCapture", (payload: CapturedAction) => {
    if (!recording) return;
    if (payload.selector) {
      payload.locatorKey = keyForSelector(
        payload.selector,
        payload.description || payload.type
      );
    }
    pushAction(payload);
  });

  await p.addInitScript(() => {
    const cssPath = (el: Element | null): string => {
      if (!el || !(el instanceof Element)) return "body";
      if (el.id) return `#${CSS.escape(el.id)}`;
      const parts: string[] = [];
      let node: Element | null = el;
      while (node && node.nodeType === 1 && parts.length < 5) {
        let part = node.tagName.toLowerCase();
        if (node.id) {
          parts.unshift(`#${CSS.escape(node.id)}`);
          break;
        }
        const parent: Element | null = node.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(
            (c: Element) => c.tagName === node!.tagName
          );
          if (siblings.length > 1) {
            const idx = siblings.indexOf(node) + 1;
            part += `:nth-of-type(${idx})`;
          }
        }
        parts.unshift(part);
        node = parent;
      }
      return parts.join(" > ");
    };

    const send = (payload: {
      type: string;
      selector?: string;
      value?: string;
      key?: string;
      description: string;
    }) => {
      const w = window as Window & {
        __reeGoCapture?: (p: unknown) => void;
      };
      w.__reeGoCapture?.(payload);
    };

    document.addEventListener(
      "click",
      (ev) => {
        const t = ev.target as Element | null;
        if (!t) return;
        const selector = cssPath(t);
        const label =
          (t as HTMLElement).innerText?.trim().slice(0, 40) ||
          t.getAttribute("aria-label") ||
          t.getAttribute("name") ||
          t.tagName.toLowerCase();
        send({
          type: "click",
          selector,
          description: `Click "${label}"`,
        });
      },
      true
    );

    document.addEventListener(
      "change",
      (ev) => {
        const t = ev.target as HTMLInputElement | HTMLSelectElement | null;
        if (!t) return;
        const selector = cssPath(t);
        const label =
          t.getAttribute("name") ||
          t.getAttribute("placeholder") ||
          t.id ||
          t.tagName.toLowerCase();
        if (t instanceof HTMLInputElement && t.type === "checkbox") {
          send({
            type: t.checked ? "check" : "uncheck",
            selector,
            description: `${t.checked ? "Check" : "Uncheck"} "${label}"`,
          });
          return;
        }
        if (t instanceof HTMLSelectElement) {
          send({
            type: "select",
            selector,
            value: t.value,
            description: `Select "${t.value}" in "${label}"`,
          });
          return;
        }
        send({
          type: "fill",
          selector,
          value: (t as HTMLInputElement).value,
          description: `Fill "${label}"`,
        });
      },
      true
    );

    document.addEventListener(
      "keydown",
      (ev) => {
        if (ev.key !== "Enter" && ev.key !== "Tab" && ev.key !== "Escape") return;
        const t = ev.target as Element | null;
        send({
          type: "press",
          selector: t ? cssPath(t) : "body",
          key: ev.key,
          description: `Press ${ev.key}`,
        });
      },
      true
    );
  });

  p.on("framenavigated", (frame) => {
    if (!recording || frame !== p.mainFrame()) return;
    const url = frame.url();
    if (!url || url === "about:blank") return;
    const last = actions[actions.length - 1];
    if (last?.type === "goto" && last.url === url) return;
    pushAction({
      type: "goto",
      url,
      description: `Navigate to ${url}`,
    });
  });
}

export function isRecording(): boolean {
  return recording;
}

export async function startRecording(options: {
  url: string;
  deviceProfile: DeviceProfile;
  progress: ProgressCallback;
}): Promise<void> {
  if (recording) throw new Error("Already recording");
  await stopSession(false);

  onProgress = options.progress;
  actions = [];
  locatorCounter = 0;
  selectorToKey.clear();
  recording = true;

  onProgress({ kind: "status", message: "Launching browser…" });

  const headless = process.env.REEGO_HEADLESS === "1";
  browser = await chromium.launch({
    headless,
    args: ["--disable-dev-shm-usage"],
  });
  const opts = deviceOptions(options.deviceProfile);
  context = await browser.newContext(opts);
  page = await context.newPage();
  await attachCapture(page);

  pushAction({
    type: "goto",
    url: options.url,
    description: `Open ${options.url}`,
  });
  await page.goto(options.url, { waitUntil: "domcontentloaded" });
  onProgress({ kind: "status", message: "Recording — interact in the Playwright window" });

  screenshotTimer = setInterval(() => {
    void captureScreenshot();
  }, 1200);
  await captureScreenshot();
}

export async function stopRecording(): Promise<RecordResult> {
  if (!recording) throw new Error("Not recording");
  recording = false;
  if (screenshotTimer) {
    clearInterval(screenshotTimer);
    screenshotTimer = null;
  }
  await captureScreenshot();
  await stopSession(false);

  const script = generateScript(actions);
  const steps = actions.map((a) => ({
    description: a.description,
    actionType: a.type,
    locatorKey: a.locatorKey ?? null,
  }));
  const locators = Array.from(selectorToKey.entries()).map(([selector, key]) => ({
    key,
    selector,
  }));

  onProgress?.({ kind: "status", message: "Recording saved" });
  onProgress = null;

  return { actions, script, steps, locators };
}

export async function runScript(options: {
  scriptContent: string;
  baseUrl: string;
  deviceProfile: DeviceProfile;
  locators: Array<{ key: string; selector: string }>;
  progress: ProgressCallback;
}): Promise<{ ok: boolean; error?: string }> {
  await stopSession(false);
  onProgress = options.progress;
  onProgress({ kind: "status", message: "Starting run…" });

  const locatorMap = Object.fromEntries(
    options.locators.map((l) => [l.key, l.selector])
  );

  const headless = process.env.REEGO_HEADLESS === "1";
  browser = await chromium.launch({
    headless,
    args: ["--disable-dev-shm-usage"],
  });
  const opts = deviceOptions(options.deviceProfile);
  context = await browser.newContext(opts);
  page = await context.newPage();

  screenshotTimer = setInterval(() => {
    void captureScreenshot();
  }, 1200);

  try {
    await executeGeneratedScript(
      page,
      options.scriptContent,
      options.baseUrl,
      locatorMap
    );
    await captureScreenshot();
    onProgress({ kind: "status", message: "Run passed" });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    onProgress({ kind: "error", message });
    return { ok: false, error: message };
  } finally {
    if (screenshotTimer) {
      clearInterval(screenshotTimer);
      screenshotTimer = null;
    }
    await stopSession(false);
    onProgress = null;
  }
}

async function executeGeneratedScript(
  p: Page,
  scriptContent: string,
  baseUrl: string,
  locators: Record<string, string>
): Promise<void> {
  // Prefer structured execution from comment markers; fall back to action parsing.
  const lines = scriptContent.split("\n");
  const actionLines = lines.filter((l) => l.trim().startsWith("// @action "));
  if (actionLines.length > 0) {
    for (const line of actionLines) {
      const json = line.replace("// @action", "").trim();
      const action = JSON.parse(json) as CapturedAction;
      await runAction(p, action, locators, baseUrl);
    }
    return;
  }

  // Fallback: naive sequential parse of page.goto / page.click / page.fill
  const callRe =
    /await page\.(goto|click|fill|press|selectOption|check|uncheck)\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = callRe.exec(scriptContent))) {
    const method = match[1];
    const argsRaw = match[2];
    const args = parseArgs(argsRaw);
    if (method === "goto") {
      await p.goto(resolveUrl(args[0], baseUrl), { waitUntil: "domcontentloaded" });
    } else if (method === "click") {
      await p.click(resolveSelector(args[0], locators));
    } else if (method === "fill") {
      await p.fill(resolveSelector(args[0], locators), unquote(args[1] ?? ""));
    } else if (method === "press") {
      await p.press(resolveSelector(args[0], locators), unquote(args[1] ?? "Enter"));
    } else if (method === "selectOption") {
      await p.selectOption(resolveSelector(args[0], locators), unquote(args[1] ?? ""));
    } else if (method === "check") {
      await p.check(resolveSelector(args[0], locators));
    } else if (method === "uncheck") {
      await p.uncheck(resolveSelector(args[0], locators));
    }
  }
}

async function runAction(
  p: Page,
  action: CapturedAction,
  locators: Record<string, string>,
  baseUrl: string
): Promise<void> {
  const selector = action.locatorKey
    ? locators[action.locatorKey] || action.selector
    : action.selector;

  switch (action.type) {
    case "goto":
      await p.goto(resolveUrl(action.url || baseUrl, baseUrl), {
        waitUntil: "domcontentloaded",
      });
      break;
    case "click":
      if (!selector) throw new Error("Click missing selector");
      await p.click(selector, { timeout: 15000 });
      break;
    case "fill":
      if (!selector) throw new Error("Fill missing selector");
      await p.fill(selector, action.value ?? "", { timeout: 15000 });
      break;
    case "press":
      if (!selector) throw new Error("Press missing selector");
      await p.press(selector, action.key ?? "Enter", { timeout: 15000 });
      break;
    case "select":
      if (!selector) throw new Error("Select missing selector");
      await p.selectOption(selector, action.value ?? "", { timeout: 15000 });
      break;
    case "check":
      if (!selector) throw new Error("Check missing selector");
      await p.check(selector, { timeout: 15000 });
      break;
    case "uncheck":
      if (!selector) throw new Error("Uncheck missing selector");
      await p.uncheck(selector, { timeout: 15000 });
      break;
  }
}

function resolveUrl(url: string, baseUrl: string): string {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return url || baseUrl;
  }
}

function resolveSelector(
  raw: string,
  locators: Record<string, string>
): string {
  const value = unquote(raw);
  if (value.startsWith("locators.")) {
    const key = value.slice("locators.".length);
    return locators[key] || value;
  }
  if (locators[value]) return locators[value];
  return value;
}

function unquote(s: string): string {
  const t = s.trim();
  if (
    (t.startsWith("'") && t.endsWith("'")) ||
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("`") && t.endsWith("`"))
  ) {
    return t.slice(1, -1);
  }
  return t;
}

function parseArgs(raw: string): string[] {
  const parts: string[] = [];
  let cur = "";
  let quote: string | null = null;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (quote) {
      cur += ch;
      if (ch === quote && raw[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === ",") {
      parts.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

export function generateScript(actions: CapturedAction[]): string {
  const body: string[] = [
    "import { test, expect } from '@playwright/test';",
    "",
    "// Locator keys are resolved at runtime from the Locators map.",
    "const locators: Record<string, string> = {};",
    "",
    "test('recorded workflow', async ({ page }) => {",
  ];

  for (const action of actions) {
    body.push(`  // @action ${JSON.stringify(action)}`);
    switch (action.type) {
      case "goto":
        body.push(`  await page.goto('${escapeQs(action.url || "")}');`);
        break;
      case "click":
        body.push(
          `  await page.click(locators['${action.locatorKey}'] ?? '${escapeQs(action.selector || "")}');`
        );
        break;
      case "fill":
        body.push(
          `  await page.fill(locators['${action.locatorKey}'] ?? '${escapeQs(action.selector || "")}', '${escapeQs(action.value || "")}');`
        );
        break;
      case "press":
        body.push(
          `  await page.press(locators['${action.locatorKey}'] ?? '${escapeQs(action.selector || "")}', '${escapeQs(action.key || "Enter")}');`
        );
        break;
      case "select":
        body.push(
          `  await page.selectOption(locators['${action.locatorKey}'] ?? '${escapeQs(action.selector || "")}', '${escapeQs(action.value || "")}');`
        );
        break;
      case "check":
        body.push(
          `  await page.check(locators['${action.locatorKey}'] ?? '${escapeQs(action.selector || "")}');`
        );
        break;
      case "uncheck":
        body.push(
          `  await page.uncheck(locators['${action.locatorKey}'] ?? '${escapeQs(action.selector || "")}');`
        );
        break;
    }
    body.push("");
  }

  body.push("});", "");
  return body.join("\n");
}

function escapeQs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function stopSession(throwIfMissing: boolean): Promise<void> {
  if (screenshotTimer) {
    clearInterval(screenshotTimer);
    screenshotTimer = null;
  }
  try {
    if (page && !page.isClosed()) await page.close().catch(() => undefined);
  } catch {
    /* ignore */
  }
  page = null;
  try {
    if (context) await context.close().catch(() => undefined);
  } catch {
    /* ignore */
  }
  context = null;
  try {
    if (browser) await browser.close().catch(() => undefined);
  } catch {
    /* ignore */
  }
  browser = null;
  if (throwIfMissing && !browser) {
    /* no-op */
  }
}

export async function disposePlaywright(): Promise<void> {
  recording = false;
  await stopSession(false);
  onProgress = null;
}
