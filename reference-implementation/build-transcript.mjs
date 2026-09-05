// Writes a plain-text transcript of a cut.
//
//   node build-transcript.mjs [--teaser] [--manifest other.json] [--out other]
//
// This is the artifact people actually use: a screen reader reads it straight through, a
// reviewer comments on it without scrubbing the video, someone searching for a phrase finds
// the demo at all, and a translator has something to work from. It is also the cheapest
// review loop there is — the wording of a demo is easier to fix here than after it is spoken.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pickScenes } from './lib/track-timeline.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'build');

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1] : fallback;
};

async function main() {
  const manifest = JSON.parse(await readFile(path.join(OUT, arg('--manifest', 'scenes.json')), 'utf8'));
  const teaser = process.argv.includes('--teaser');
  const base = arg('--out', teaser ? 'walkthrough-teaser' : 'walkthrough');
  const scenes = await pickScenes(manifest, { teaser, scenesModule: arg('--scenes', 'scenes.mjs') });

  const parts = [manifest.title || 'Guided walkthrough'];
  if (manifest.subtitle) parts.push(manifest.subtitle);
  if (manifest.disclaimer) parts.push(manifest.disclaimer);
  parts.push('');

  for (const scene of scenes) {
    if (scene.title) parts.push(`[${scene.title}]`);
    parts.push(scene.say, '');
  }
  parts.push('— End of transcript. —');

  const file = path.join(OUT, `${base}.txt`);
  await writeFile(file, parts.join('\n'), 'utf8');
  console.log(`${base}.txt — ${scenes.length} scenes`);
}

main();
