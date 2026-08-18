// Drives a real running web app through a list of scenes and writes one screenshot each.
//
//   node capture.mjs                     all scenes in scenes.mjs
//   node capture.mjs --scenes other.mjs --manifest other.json
//   node capture.mjs 13 14               only those scene indexes (fixing one broken scene)
//   DEMO_HEADED=1 node capture.mjs       watch it happen in a visible browser window
//
// Output: build/shots/<id>.png and build/<manifest>.json (default build/scenes.json).
//
// This file is product-agnostic. It knows how to drive ANY web page — navigate, wait, scroll,
// click, type, take a screenshot. It has no idea what a "deal," a "user role," or any other
// domain concept in your product means. If your product needs a step beyond the generic ones
// below (switching roles, opening a specific record, logging in a particular way), add it as a
// CUSTOM STEP exported from your own scenes file — see "Extending with custom steps" below and
// scenes.example.mjs for a worked example. Do not fork this file to add product-specific logic.

import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './lib/cdp.mjs';

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1] : fallback;
};
const SCENES_MODULE = arg('--scenes', 'scenes.mjs');
const MANIFEST = arg('--manifest', 'scenes.json');
const mod = await import(`./${SCENES_MODULE}`);
const { BASE, SCENES, ACTS } = mod;
// Optional: a project's own scenes file can export CUSTOM_STEPS, an object mapping a verb
// name to an async handler `(session, arg, state) => void`, to add domain-specific steps
// (log in as a role, open a specific record, dismiss a product-specific toast) without
// touching this file. See "Extending with custom steps" below.
const CUSTOM_STEPS = mod.CUSTOM_STEPS || {};
// Optional: called once per scene, before that scene's own `steps` run, if the scene sets an
// `actor` field — mirrors a common "switch persona/role, then act" pattern without baking any
// one product's notion of a role into this file. Leave undefined if your product has no such
// concept.
const setActor = mod.setActor;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'build');
const SHOTS = path.join(OUT, 'shots');

const WIDTH = Number(process.env.DEMO_WIDTH || 1440);
const HEIGHT = Number(process.env.DEMO_HEIGHT || 900);
const SCALE = Number(process.env.DEMO_SCALE || 2);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const js = (s) => JSON.stringify(String(s));

// Helpers injected into the page. Text matching is how a person finds things on a screen, and
// it survives a CSS refactor in a way a generated class name does not.
const HELPERS = `
window.__demo = {
  scroller() { return document.scrollingElement || document.documentElement; },
  visible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1 && getComputedStyle(el).visibility !== 'hidden';
  },
  // The smallest element whose own text matches — avoids matching <body>.
  byText(needle, tags) {
    const want = String(needle).toLowerCase();
    const sel = tags || 'button,a,h1,h2,h3,h4,div,span,td,li,label,p,strong';
    const hits = [...document.querySelectorAll(sel)].filter((e) => {
      if (!window.__demo.visible(e)) return false;
      const t = (e.innerText || '').trim().toLowerCase();
      return t.includes(want);
    });
    if (!hits.length) return null;
    hits.sort((a, b) => (a.innerText || '').length - (b.innerText || '').length);
    return hits[0];
  },
  clickable(needle) {
    const want = String(needle).toLowerCase();
    const els = [...document.querySelectorAll('button,a,[role=button],[role=tab],select,input')];
    const exact = els.filter((e) => window.__demo.visible(e)
      && (e.innerText || e.value || '').trim().toLowerCase() === want);
    if (exact.length) return exact[0];
    const loose = els.filter((e) => window.__demo.visible(e)
      && (e.innerText || e.value || '').trim().toLowerCase().includes(want));
    loose.sort((a, b) => (a.innerText || '').length - (b.innerText || '').length);
    return loose[0] || null;
  },
  rect(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  },
  // A heading is where the text matches, but the panel is what the narrator is talking
  // about, so grow the match up to the card it belongs to.
  panel(el) {
    const stop = window.__demo.scroller();
    const vh = window.innerHeight;
    let best = el, n = el;
    for (let i = 0; i < 10 && n && n.parentElement; i++) {
      n = n.parentElement;
      if (n === stop || n === document.body || n === document.documentElement) break;
      const r = n.getBoundingClientRect();
      if (r.height > vh * 1.8) break;
      if (r.height > best.getBoundingClientRect().height) best = n;
    }
    return best;
  },
  resolve(spec, grow) {
    if (!spec) return null;
    if (!String(spec).startsWith('text:')) return document.querySelector(spec);
    const el = window.__demo.byText(String(spec).slice(5));
    if (!el) return null;
    return grow ? window.__demo.panel(el) : el;
  },
};
true;
`;

async function inject(s) { await s.eval(HELPERS); }

async function settle(s) {
  await s.eval(`document.fonts ? document.fonts.ready.then(() => true) : true`).catch(() => {});
  await sleep(500);
}

// ── the generic step vocabulary ──────────────────────────────────────────────
//
// Every verb here works on any web page. Do not add product-specific verbs here — export a
// CUSTOM_STEPS object from your own scenes file instead (see the top of this file).
async function runStep(s, step, state) {
  const [verb, arg] = Object.entries(step)[0];

  switch (verb) {
    case 'goto':
      await s.navigate(`${BASE}${arg}`);
      await inject(s);
      break;

    case 'wait':
      await sleep(arg);
      break;

    case 'waitText':
      await s.waitFor(`document.body.innerText.includes(${js(arg)})`, { timeout: 60000, label: `text ${arg}` });
      break;

    case 'scrollTop':
      await s.eval(`(() => { const sc = window.__demo.scroller(); sc.scrollTop = ${Number(arg)}; return true; })()`);
      await sleep(700);
      break;

    case 'scrollTo':
      await s.waitFor(`!!window.__demo.byText(${js(arg)})`, { timeout: 30000, label: `panel ${arg}` });
      await s.eval(`(() => {
        const el = window.__demo.byText(${js(arg)});
        const sc = window.__demo.scroller();
        const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
        sc.scrollTo({ top: Math.max(0, top - 24), behavior: 'instant' });
        return true;
      })()`);
      await sleep(900);
      break;

    case 'clickText': {
      await s.waitFor(`!!window.__demo.clickable(${js(arg)})`, { timeout: 30000, label: `control ${arg}` });
      const r = await s.eval(`(() => {
        const el = window.__demo.clickable(${js(arg)});
        const rect = window.__demo.rect(el);
        el.click();
        return rect;
      })()`);
      state.lastClick = r;
      await sleep(900);
      break;
    }

    case 'click': {
      const r = await s.eval(`(() => {
        const el = document.querySelector(${js(arg)});
        if (!el) return null;
        const rect = window.__demo.rect(el);
        el.click();
        return rect;
      })()`);
      state.lastClick = r;
      await sleep(900);
      break;
    }

    // Types into a text input/textarea matched by CSS selector: { type: ['selector', 'text'] }
    case 'type': {
      const [selector, text] = arg;
      await s.eval(`(() => {
        const el = document.querySelector(${js(selector)});
        if (!el) throw new Error('no element for ' + ${js(selector)});
        const setter = Object.getOwnPropertyDescriptor(el.__proto__, 'value')?.set
          || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, ${js(text)});
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      })()`);
      await sleep(300);
      break;
    }

    // Dispatches a single key press to the page: { press: 'Enter' }
    case 'press':
      await s.eval(`(() => {
        document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: ${js(arg)}, bubbles: true }));
        return true;
      })()`);
      await sleep(300);
      break;

    // Closes a dismissible banner/toast matched by its own text, if present. Does nothing
    // (and does not error) if no such element exists — safe to run unconditionally.
    // { dismiss: 'text the banner starts with' }
    case 'dismiss':
      await s.eval(`(() => {
        const bar = [...document.querySelectorAll('div,section')]
          .filter((e) => (e.innerText || '').startsWith(${js(arg)}))
          .sort((a, b) => a.innerText.length - b.innerText.length)[0];
        const x = bar && [...bar.querySelectorAll('button')]
          .find((b) => /^[x\u00d7]$/i.test(b.innerText.trim()) || /close|dismiss/i.test(b.getAttribute('aria-label') || ''));
        if (x) x.click();
        return true;
      })()`);
      await sleep(500);
      break;

    default: {
      const custom = CUSTOM_STEPS[verb];
      if (!custom) throw new Error(`unknown step: ${verb} (add it to CUSTOM_STEPS in your scenes file)`);
      await custom(s, arg, state);
    }
  }
}

async function main() {
  const only = process.argv.slice(2).map(Number).filter((n) => !Number.isNaN(n));
  const list = only.length ? only.map((i) => SCENES[i]).filter(Boolean) : SCENES;

  // A partial run is for fixing one broken scene, so it must not throw away the rest.
  let previous = [];
  if (only.length) {
    previous = await readFile(path.join(OUT, MANIFEST), 'utf8')
      .then((t) => JSON.parse(t).scenes).catch(() => []);
  } else if (MANIFEST === 'scenes.json') {
    // Clear the screenshots for the DEFAULT manifest only, never build/audio — that costs a
    // Speech call per scene and does not change when a selector does. Recapturing a NAMED
    // manifest (any --manifest other than the default) never touches shots/ at all, so other
    // decks' screenshots already captured in this session are never at risk.
    await rm(SHOTS, { recursive: true, force: true }).catch(() => {});
  }
  await mkdir(SHOTS, { recursive: true });

  const s = await launch({
    width: WIDTH, height: HEIGHT, scale: SCALE,
    headless: !process.env.DEMO_HEADED,
  });

  // Optional: if your product needs an auth header on every request (a bearer token, a
  // service-account credential), set DEMO_AUTH_HEADER as "Header-Name: value" and it is
  // attached to every request the captured page makes.
  if (process.env.DEMO_AUTH_HEADER) {
    const [name, ...rest] = process.env.DEMO_AUTH_HEADER.split(':');
    await s.setHeaders({ [name.trim()]: rest.join(':').trim() });
  }

  const state = { lastClick: null };
  const manifest = [];

  try {
    for (const [i, scene] of list.entries()) {
      const label = `${String(i + 1).padStart(2, '0')}/${list.length} ${scene.id}`;
      try {
        if (scene.actor && setActor) await setActor(s, scene.actor, state);
        await inject(s);
        for (const step of scene.steps || []) await runStep(s, step, state);
        await inject(s);
        await settle(s);

        const spotlight = scene.spotlight
          ? await s.eval(`window.__demo.rect(window.__demo.resolve(${js(scene.spotlight)}, true))`)
          : null;
        const click = scene.click
          ? await s.eval(`window.__demo.rect(window.__demo.resolve(${js(scene.click)}, false))`)
          : null;

        const file = `${scene.id}.png`;
        await s.screenshot({ path: path.join(SHOTS, file) });

        manifest.push({
          id: scene.id, act: scene.act, title: scene.title, actor: scene.actor,
          say: scene.say.replace(/\s+/g, ' ').trim(),
          image: `shots/${file}`, spotlight, click,
        });
        console.log(`  ok  ${label}`);
      } catch (e) {
        console.log(`  FAIL ${label} — ${e.message}`);
        manifest.push({
          id: scene.id, act: scene.act, title: scene.title, actor: scene.actor,
          say: scene.say.replace(/\s+/g, ' ').trim(),
          image: null, error: e.message,
        });
      }
    }
  } finally {
    await s.close();
  }

  await writeFile(
    path.join(OUT, MANIFEST),
    JSON.stringify({
      capturedAt: new Date().toISOString(),
      base: BASE,
      title: mod.TITLE || 'Guided walkthrough',
      subtitle: mod.SUBTITLE || '',
      disclaimer: mod.DISCLAIMER || '',
      viewport: { width: WIDTH, height: HEIGHT, scale: SCALE },
      acts: ACTS,
      scenes: SCENES.map((sc) => manifest.find((m) => m.id === sc.id)
        || previous.find((m) => m.id === sc.id))
        .filter(Boolean),
    }, null, 2),
    'utf8',
  );

  const ok = manifest.filter((m) => m.image).length;
  console.log(`\ncaptured ${ok}/${list.length} scenes`);
}

main();

// ── Extending with custom steps ──────────────────────────────────────────────
//
// Your product almost certainly has domain concepts this file has no business knowing about:
// switching between user roles, opening a specific record, dismissing a product-specific
// modal that needs more than a text match. Add them as CUSTOM_STEPS in your own scenes file:
//
//   export const CUSTOM_STEPS = {
//     async switchRole(session, roleId, state) {
//       await session.eval(`...set a <select> to ${JSON.stringify(roleId)} and dispatch change...`);
//       state.role = roleId;
//     },
//   };
//
// Then use it in a scene like any built-in step: `steps: [{ switchRole: 'admin' }]`.
// See scenes.example.mjs for a complete worked example, including the `actor` field pattern
// for auto-switching a role before a scene's own steps run.
