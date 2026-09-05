// Writes the caption files for a cut, timed from the voice itself.
//
//   node build-captions.mjs                          walkthrough.srt/.vtt/.ttml
//   node build-captions.mjs --teaser                 the short cut
//   node build-captions.mjs --manifest other.json --out other
//
// Three formats because three things consume them:
//   .vtt   the web (and the HTML player)
//   .srt   most video tools and social platforms
//   .ttml  what Microsoft Stream and several enterprise video platforms accept for
//          uploaded caption tracks
//
// The captions are NOT burned into the picture. A viewer who needs them turns them on, a
// viewer who does not gets a clean frame, and either way the text stays selectable and
// translatable — which burned-in text is not.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCues } from './lib/caption-chunks.mjs';
import { timeline, pickScenes } from './lib/track-timeline.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'build');

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1] : fallback;
};

const pad = (n, w = 2) => String(n).padStart(w, '0');
function clock(t, msSep) {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const ms = Math.round((t - Math.floor(t)) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}${msSep}${pad(ms, 3)}`;
}

const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function toSrt(cues) {
  return cues.map((c, i) => `${i + 1}\n${clock(c.start, ',')} --> ${clock(c.end, ',')}\n${c.text}\n`)
    .join('\n');
}

function toVtt(cues) {
  return `WEBVTT\n\n${cues.map((c) => `${clock(c.start, '.')} --> ${clock(c.end, '.')}\n${c.text}\n`).join('\n')}`;
}

function toTtml(cues, title) {
  const body = cues.map((c) => `      <p begin="${clock(c.start, '.')}" end="${clock(c.end, '.')}">`
    + `${xml(c.text).replace(/\n/g, '<br/>')}</p>`).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling" xml:lang="en">
  <head>
    <metadata xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><ttm:title>${xml(title)}</ttm:title></metadata>
    <styling>
      <style xml:id="s1" tts:fontFamily="sansSerif" tts:fontSize="100%" tts:color="white"
             tts:backgroundColor="black" tts:textAlign="center"/>
    </styling>
    <layout>
      <region xml:id="bottom" tts:origin="10% 80%" tts:extent="80% 20%" tts:displayAlign="after"/>
    </layout>
  </head>
  <body>
    <div style="s1" region="bottom">
${body}
    </div>
  </body>
</tt>
`;
}

async function main() {
  const manifest = JSON.parse(await readFile(path.join(OUT, arg('--manifest', 'scenes.json')), 'utf8'));
  const teaser = process.argv.includes('--teaser');
  const base = arg('--out', teaser ? 'walkthrough-teaser' : 'walkthrough');

  const scenes = await pickScenes(manifest, { teaser, scenesModule: arg('--scenes', 'scenes.mjs') });
  const rows = await timeline(scenes);

  const cues = [];
  for (const { scene, start, end } of rows) {
    if (!scene.words?.length) {
      // Without word timings there is nothing honest to do but show the line for the scene.
      // Re-record with narrate.mjs to get real timings.
      console.log(`  ! ${scene.id}: no word timings — captions for this scene are one block. `
        + `Re-run narrate.mjs to capture them.`);
      cues.push({ text: scene.say, start, end });
      continue;
    }
    cues.push(...buildCues({ words: scene.words, start, end }));
  }

  const title = manifest.title || 'Guided walkthrough';
  await writeFile(path.join(OUT, `${base}.srt`), toSrt(cues), 'utf8');
  await writeFile(path.join(OUT, `${base}.vtt`), toVtt(cues), 'utf8');
  await writeFile(path.join(OUT, `${base}.ttml`), toTtml(cues, title), 'utf8');

  console.log(`${cues.length} cues across ${scenes.length} scenes`);
  console.log(`${base}.srt, ${base}.vtt, ${base}.ttml`);
}

main();
