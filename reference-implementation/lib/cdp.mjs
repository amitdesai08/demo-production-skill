// A very small Chrome DevTools Protocol client.
//
// The npm registry is not reachable from the build machine, so Playwright is not an
// option. Everything here runs on what Node 24 already has: fetch to read the debugger's
// target list, and the built-in WebSocket to speak CDP. That is the whole dependency list.

import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const BROWSERS = [
  `${process.env['ProgramFiles(x86)']}\\Microsoft\\Edge\\Application\\msedge.exe`,
  `${process.env.ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
  `${process.env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env['ProgramFiles(x86)']}\\Google\\Chrome\\Application\\chrome.exe`,
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function findBrowser() {
  const { access } = await import('node:fs/promises');
  for (const b of BROWSERS) {
    try { await access(b); return b; } catch { /* next */ }
  }
  throw new Error('No Edge or Chrome found. Install one, or set DEMO_BROWSER to an executable.');
}

export class Session {
  #ws; #id = 0; #pending = new Map(); #handlers = new Map();

  constructor(ws) {
    this.#ws = ws;
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id != null) {
        const p = this.#pending.get(msg.id);
        if (!p) return;
        this.#pending.delete(msg.id);
        msg.error ? p.reject(new Error(`${msg.error.message} (${p.method})`)) : p.resolve(msg.result);
        return;
      }
      for (const h of this.#handlers.get(msg.method) || []) h(msg.params);
    });
  }

  send(method, params = {}) {
    const id = ++this.#id;
    this.#ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject, method });
      setTimeout(() => {
        if (!this.#pending.has(id)) return;
        this.#pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 120000);
    });
  }

  on(method, fn) {
    if (!this.#handlers.has(method)) this.#handlers.set(method, []);
    this.#handlers.get(method).push(fn);
    return () => {
      const a = this.#handlers.get(method);
      a.splice(a.indexOf(fn), 1);
    };
  }

  /** Run an expression in the page and return its value. Throws what the page throws. */
  async eval(expression, { awaitPromise = true } = {}) {
    const r = await this.send('Runtime.evaluate', {
      expression, awaitPromise, returnByValue: true, userGesture: true,
    });
    if (r.exceptionDetails) {
      const e = r.exceptionDetails;
      throw new Error(`page error: ${e.exception?.description || e.text}`);
    }
    return r.result?.value;
  }

  /** Poll an expression until it is truthy. Returns the value it settled on. */
  async waitFor(expression, { timeout = 45000, interval = 250, label = expression } = {}) {
    const until = Date.now() + timeout;
    let last;
    for (;;) {
      try { last = await this.eval(expression); } catch { last = undefined; }
      if (last) return last;
      if (Date.now() > until) throw new Error(`timed out waiting for: ${label}`);
      await sleep(interval);
    }
  }

  async navigate(url) {
    const loaded = new Promise((resolve) => {
      const off = this.on('Page.loadEventFired', () => { off(); resolve(); });
      setTimeout(resolve, 30000);
    });
    await this.send('Page.navigate', { url });
    await loaded;
  }

  async screenshot({ path: outPath, quality } = {}) {    const r = await this.send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: false, ...(quality ? { quality } : {}),
    });
    const buf = Buffer.from(r.data, 'base64');
    if (outPath) {
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(path.dirname(outPath), { recursive: true });
      await writeFile(outPath, buf);
    }
    return buf;
  }
}

async function connect(port, { width, height, scale, cleanup }) {
  // The debugger takes a moment to open its port (or may already be up, for attach()).
  let target = null;
  for (let i = 0; i < 80 && !target; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
      target = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
    } catch { /* not up yet */ }
    if (!target) await sleep(250);
  }
  if (!target) throw new Error(`browser debugger never came up on port ${port}`);

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('CDP socket failed')), { once: true });
  });

  const s = new Session(ws);
  await s.send('Page.enable');
  await s.send('Runtime.enable');
  await s.send('Network.enable');
  // Headless paints whatever it is told to, so this is where capture resolution is decided.
  await s.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: scale, mobile: false,
  });

  /** Attach headers to every request the page makes — how the capture authenticates. */
  s.setHeaders = (headers) => s.send('Network.setExtraHTTPHeaders', { headers });
  s.close = async () => {
    try { ws.close(); } catch { /* already gone */ }
    await cleanup();
  };
  return s;
}

export async function launch({ width = 1440, height = 900, scale = 2, headless = true } = {}) {
  const exe = process.env.DEMO_BROWSER || await findBrowser();
  // A product that needs an authenticated session (a real sign-in, not a header token) has to
  // reuse the SAME profile across runs, so the sign-in survives from one capture to the next.
  // Default behaviour (no env var) is unchanged: a fresh temp profile, deleted on close().
  const persistent = process.env.DEMO_PROFILE_DIR;
  if (persistent) await mkdir(persistent, { recursive: true });
  const profile = persistent || await mkdtemp(path.join(tmpdir(), 'demo-capture-'));
  // A fixed port (DEMO_PORT) lets a later, separate process attach() to THIS SAME running
  // browser instead of launching a new one — the only way a real, human-completed interactive
  // sign-in (one a synthetic/automated click cannot complete, by design) can survive past the
  // script that opened the window, since the sign-in lives in the browser process itself, not
  // on disk.
  const port = Number(process.env.DEMO_PORT) || 9000 + Math.floor(Math.random() * 900);

  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    '--no-first-run', '--no-default-browser-check', '--disable-sync',
    '--disable-extensions', '--disable-background-networking',
    '--hide-scrollbars', '--force-device-scale-factor=1',
    'about:blank',
  ];
  if (headless) args.unshift('--headless=new');

  const proc = spawn(exe, args, { stdio: 'ignore', detached: true });
  // Detached + unref'd so the browser survives this script's own process exiting — needed for
  // a real, human-completed interactive sign-in (open-for-signin-style usage) where the
  // browser must keep running after the script that opened it returns control.
  proc.unref();

  return connect(port, {
    width, height, scale,
    cleanup: async () => {
      try { proc.kill(); } catch { /* already gone */ }
      await sleep(400);
      if (!persistent) await rm(profile, { recursive: true, force: true }).catch(() => {});
    },
  });
}

/**
 * Connects to an ALREADY-RUNNING browser (started by launch() with a fixed DEMO_PORT and left
 * open) instead of spawning a new one. Its own close() only closes the CDP socket — it never
 * kills the browser process or deletes its profile, since some other script (or a person) may
 * still be using that window.
 */
export async function attach(port, { width = 1440, height = 900, scale = 2 } = {}) {
  return connect(port, { width, height, scale, cleanup: async () => {} });
}
