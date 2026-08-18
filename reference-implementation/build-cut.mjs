// Assembles a cut's manifest from screens the walkthrough already captured.
//
//   node build-cut.mjs lightning
//
// No browser, no capture: the screenshots are borrowed from an already-captured manifest, so
// only the narration is new. Writes build/scenes-<cut>.json for narrate/build-player/build-video.
// The cut definitions themselves live in your own cuts.mjs (see cuts.example.mjs) as a CUTS
// object keyed by cut name.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CUTS } from './cuts.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'build');

async function main() {
  const name = process.argv[2];
  const cut = CUTS[name];
  if (!cut) {
    console.error(`unknown cut: ${name || '(none given)'}. Known: ${Object.keys(CUTS).join(', ')}`);
    process.exit(1);
  }

  const sources = cut.sources || ['scenes.json'];
  const byId = {};
  let meta = null;
  for (const file of sources) {
    const m = JSON.parse(await readFile(path.join(OUT, file), 'utf8'));
    meta = meta || m;
    for (const s of m.scenes) byId[s.id] = s;
  }
  const source = meta;

  const missing = cut.scenes.filter((s) => !byId[s.use] || !byId[s.use].image);
  if (missing.length) {
    console.error('these scenes have not been captured: ' + missing.map((m) => m.use).join(', '));
    console.error('run node capture.mjs first');
    process.exit(1);
  }

  const scenes = cut.scenes.map((s, n) => {
    const src = byId[s.use];
    // A cut usually re-writes the line for its own pacing, but a scene captured for this
    // deck already has the right one.
    const say = (s.say || src.say || '').replace(/\s+/g, ' ').trim();
    if (!say) throw new Error(`${s.use} has no narration, in the cut or the capture`);
    return {
      id: `${name}-${String(n).padStart(2, '0')}-${s.use}`,
      act: s.act,
      title: s.title || src.title,
      actor: src.actor,
      say,
      image: src.image,
      spotlight: src.spotlight || null,
      // A cut re-orders scenes, so a cursor pointing at the control that led to the *next*
      // screen in the walkthrough would now point somewhere that never follows.
      click: null,
      from: s.use,
    };
  });

  const out = path.join(OUT, `scenes-${name}.json`);
  await writeFile(out, JSON.stringify({
    capturedAt: source.capturedAt,
    base: source.base,
    title: cut.title || source.title,
    subtitle: source.subtitle,
    disclaimer: source.disclaimer,
    viewport: source.viewport,
    cut: name,
    cutTitle: cut.title,
    cutSource: cut.source,
    acts: cut.acts,
    scenes,
  }, null, 2), 'utf8');

  const words = scenes.reduce((a, s) => a + s.say.split(/\s+/).length, 0);
  console.log(`${name}: ${scenes.length} scenes, ~${words} words (roughly ${Math.round(words / 140)} min narrated)`);
  console.log(out);
}

main();
