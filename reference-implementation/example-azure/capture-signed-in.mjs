// A dedicated capture driver for the Azure-portal example only.
//
// capture.mjs's generic per-step dispatch (goto -> inject -> eval) cannot reliably ride out
// Azure AD's sign-in redirect on a fresh browser process: the session cookie is scoped to the
// browser process itself (by design, for security) and can only ever be established once per
// process, and the account-picker page's own iframe plus mid-redirect timing make the shared
// engine's assumptions (waitText/clickText see the top document; inject() runs right after
// load) unreliable here. Everything downstream of capture (narrate.mjs, build-player.mjs,
// build-video.mjs) is completely untouched and generic — this script only replaces the
// capture step, and only for this one product's login quirk. It reads its content from
// scenes.mjs (the single source of truth for narration/order), it just drives the browser
// directly instead of going through capture.mjs's step dispatcher.
//
//   node example-azure/capture-signed-in.mjs

import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from '../lib/cdp.mjs';
import * as scenes from './scenes.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', 'build');
const SHOTS = path.join(OUT, 'shots');
const MANIFEST = 'example-azure.json';

const ACCOUNT_HINT = process.env.AZ_ACCOUNT_HINT || process.env.AZ_TENANT_DOMAIN || '';
const WIDTH = Number(process.env.DEMO_WIDTH || 1440);
const HEIGHT = Number(process.env.DEMO_HEIGHT || 900);
const SCALE = Number(process.env.DEMO_SCALE || 2);

// Every scene here is just [navigate, fixed wait, screenshot] — no clicking/typing inside the
// page is needed once signed in (see scenes.mjs's header comment on the cross-origin blade
// iframe), so this loop only needs to know the URL + settle time per scene, which the wait
// step already encodes in scenes.mjs's own `steps` array.
function urlAndWait(scene) {
  const nav = scene.steps.find((s) => 'goto' in s || 'signIn' in s);
  const waitStep = scene.steps.find((s) => 'wait' in s);
  const path = nav ? (nav.goto ?? nav.signIn) : null;
  return { url: path ? `${scenes.BASE}${path}` : null, waitMs: waitStep ? waitStep.wait : 4000 };
}

async function signIn(session) {
  await new Promise((r) => setTimeout(r, 5000));
  const onLogin = await session.eval(`location.href.includes('login.microsoftonline.com')`).catch(() => true);
  if (!onLogin) return;

  await session.send('DOM.enable');
  await session.send('DOM.getDocument', { depth: -1, pierce: true });
  const { searchId, resultCount } = await session.send('DOM.performSearch', { query: ACCOUNT_HINT });
  if (resultCount > 0) {
    const { nodeIds } = await session.send('DOM.getSearchResults', { searchId, fromIndex: 0, toIndex: resultCount });
    let box = null;
    for (const nodeId of nodeIds) {
      try { ({ model: box } = await session.send('DOM.getBoxModel', { nodeId })); if (box) break; } catch { /* not this node */ }
    }
    await session.send('DOM.discardSearchResults', { searchId }).catch(() => {});
    if (box) {
      const x = (box.content[0] + box.content[4]) / 2;
      const y = (box.content[1] + box.content[5]) / 2;
      await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
      await session.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await new Promise((r) => setTimeout(r, 120));
      await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    }
  }
  // Doesn't throw on a slow/ambiguous redirect — by the time the NEXT scene navigates, the
  // background sign-in has consistently already finished even when this specific poll timed
  // out, so failing the whole run over it would be wrong. Worst case, this one screenshot is
  // retaken (see the header comment on partial re-runs).
  await session.waitFor(
    `!location.href.includes('login.microsoftonline.com')`,
    { timeout: 70000, interval: 1500, label: 'Azure sign-in to resolve' },
  ).catch((e) => console.log(`  (sign-in poll: ${e.message} — continuing anyway)`));
  await new Promise((r) => setTimeout(r, 3000));
}

async function main() {
  await rm(SHOTS, { recursive: true, force: true }).catch(() => {});
  await mkdir(SHOTS, { recursive: true });

  const s = await launch({ width: WIDTH, height: HEIGHT, scale: SCALE, headless: !process.env.DEMO_HEADED });
  const manifest = [];

  try {
    for (const [i, scene] of scenes.SCENES.entries()) {
      const label = `${String(i + 1).padStart(2, '0')}/${scenes.SCENES.length} ${scene.id}`;
      const { url, waitMs } = urlAndWait(scene);
      try {
        if (url) {
          if (i === 0) {
            // Only the FIRST scene does a real page load — this is the one that must sign in.
            await s.navigate(url);
            await signIn(s);
          } else {
            // Every later blade switch is a same-document hash change, handled entirely by
            // the Portal's own SPA router — no new top-level request to portal.azure.com, so
            // it never re-hits Azure AD's account picker (a FULL Page.navigate here was the
            // actual bug: it re-triggered sign-in on every single scene, not just the first).
            const hash = url.split('#')[1] || '';
            await s.eval(`location.hash = ${JSON.stringify(hash)}`).catch(() => {});
          }
        }
        await new Promise((r) => setTimeout(r, waitMs));

        const file = `${scene.id}.png`;
        await s.screenshot({ path: path.join(SHOTS, file) });
        manifest.push({
          id: scene.id, act: scene.act, title: scene.title,
          say: scene.say.replace(/\s+/g, ' ').trim(),
          image: `shots/${file}`,
        });
        console.log(`  ok  ${label}`);
      } catch (e) {
        console.log(`  FAIL ${label} — ${e.message}`);
        manifest.push({
          id: scene.id, act: scene.act, title: scene.title,
          say: scene.say.replace(/\s+/g, ' ').trim(), image: null, error: e.message,
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
      base: scenes.BASE,
      title: scenes.TITLE,
      subtitle: scenes.SUBTITLE,
      disclaimer: scenes.DISCLAIMER || '',
      viewport: { width: WIDTH, height: HEIGHT, scale: SCALE },
      acts: scenes.ACTS,
      scenes: manifest,
    }, null, 2),
    'utf8',
  );

  const ok = manifest.filter((m) => m.image).length;
  console.log(`\ncaptured ${ok}/${scenes.SCENES.length} scenes`);
}

main();
