// EXAMPLE scene manifest — copy this file, rename it, and replace every placeholder.
//
// This is the single source of truth for one demo track: what the browser does at each beat,
// and what the narrator says over the result. Everything downstream (capture, narration, the
// interactive player, the MP4) is generated from this file — change the demo here and nowhere
// else.
//
//   node capture.mjs      --scenes scenes.mjs --manifest scenes.json
//   node narrate.mjs      --manifest scenes.json
//   node build-player.mjs --manifest scenes.json --out demo.html
//   node build-video.mjs  --manifest scenes.json --out demo.mp4

// The base URL of the running product this demo captures against.
export const BASE = process.env.DEMO_BASE_URL || 'https://your-app.example.com';

// Shown on the interactive player's opening card. Say what the audience is about to see and
// name the disclaimer your organisation wants stated up front (e.g. "this is a demo dataset").
export const TITLE = 'Your Product — guided walkthrough';
export const SUBTITLE = 'A narrated walkthrough of the product, beat by beat.';
export const DISCLAIMER = 'Everything on screen is demonstration data.';

// Purely for grouping in the generated docs/player. `n` must match each scene's own `act`.
export const ACTS = [
  { n: 1, title: 'Opening' },
  { n: 2, title: 'The core workflow' },
  { n: 3, title: 'Close' },
];

// ── Optional: custom steps for your product's own domain concepts ───────────────────────
//
// capture.mjs ships only generic, product-agnostic steps (goto, wait, waitText, scrollTop,
// scrollTo, clickText, click, type, press, dismiss). Add anything your product needs beyond
// that here — do not modify capture.mjs itself. Each handler receives the live CDP session,
// the step's own argument, and a small mutable `state` object shared across the whole run.
export const CUSTOM_STEPS = {
  // Example: a role/persona switcher, if your product has one — mirrors the common
  // "log in as, or switch to, a named role" pattern used across many B2B demos.
  async switchRole(session, roleId, state) {
    await session.eval(`(() => {
      const sel = document.querySelector('select.role-switcher'); // <-- your product's selector
      if (!sel) return false;
      const opt = [...sel.options].find((o) => o.value === ${JSON.stringify(roleId)});
      if (!opt) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
      setter.call(sel, opt.value);
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    state.role = roleId;
  },
};

// Optional: called once per scene, before that scene's own `steps`, if the scene sets an
// `actor` field — this is what makes `actor: 'admin'` on a scene auto-switch the role before
// its steps run, the same way `switchRole` above works when called explicitly as a step.
// Leave this undefined (or delete it) if your product has no such concept.
export async function setActor(session, actor, state) {
  if (actor === state.role) return;
  await CUSTOM_STEPS.switchRole(session, actor, state);
}

export const SCENES = [
  {
    id: '01-open',
    act: 1,
    title: 'Where you land',
    steps: [{ goto: '/' }, { waitText: 'Welcome' }, { scrollTop: 0 }],
    // Style rules for this text — see references/narration-style.md in the skill docs for the
    // full, measurable calibration bar. In short: contractions, short sentences, no
    // presenter-instructions, and keep em-dashes rare (each one becomes a deliberate pause).
    say: `This is where the product lands you first. Everything you're about to see comes from
      the live record, not a mock-up — the same thing a real user would open.`,
  },
  {
    id: '02-core-workflow',
    act: 2,
    title: 'The thing people actually do here',
    actor: 'admin', // uses the optional setActor hook above, if you defined one
    steps: [{ clickText: 'Get started' }, { wait: 1500 }, { scrollTo: 'Your first project' }],
    spotlight: 'text:Your first project', // draws a highlight box in the player — doesn't click
    say: `This is the workflow the whole product exists for. It's the one thing a new user
      needs to understand before anything else makes sense.`,
  },
  {
    id: '03-close',
    act: 3,
    title: 'Close',
    steps: [{ wait: 500 }],
    say: `That's the whole shape of it: one workflow, done well, with nothing extra in the
      way. If you want to see it running on your own data, that's the natural next step.`,
  },
];

// Optional: which scene ids make up a short "teaser" cut when build-video.mjs is run with
// --teaser. If you skip this, build-video.mjs falls back to a generic every-third-scene cut.
export const TEASER_SCENES = ['01-open', '03-close'];
