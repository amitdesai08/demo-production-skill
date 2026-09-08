// Renders one title card PNG per scene, to build/titles/, plus an index of their sizes.
//
//   node build-title-cards.mjs [--manifest scenes.json] [--force]
//
// The card is drawn in the same headless browser the capture step already uses, so it can be
// a real piece of design — rounded corners, a gradient accent, a drop shadow, proper type —
// rather than the flat rectangles ffmpeg's drawbox can manage. It is captured over a
// transparent background so the video can fly the whole card, art and text together, as a
// single overlay. A title assembled from drawbox/drawtext primitives cannot do that: a
// drawbox position cannot animate at all, so the plate would sit still while the label slid
// out of it. See references/on-screen-emphasis.md.

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './lib/cdp.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'build');
const CARDS = path.join(OUT, 'titles');
const INDEX = path.join(CARDS, 'index.json');

const FORCE = process.argv.includes('--force');
const MANIFEST = (() => {
  const i = process.argv.indexOf('--manifest');
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1] : 'scenes.json';
})();

// Shared with the video's highlight colour, converted from ffmpeg's 0xRRGGBB to CSS.
const ACCENT = `#${(process.env.DEMO_VIDEO_ACCENT || '0x4F6BED').replace(/^0x/, '')}`;
// Room for the drop shadow, which falls outside the card's own box.
const BLEED = 44;
const SCALE = 2;

function html(title) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;background:transparent}
  body{padding:${BLEED}px;display:inline-block}
  .card{display:inline-flex;align-items:stretch;gap:18px;
        padding:16px 30px 16px 18px;border-radius:11px;
        background:linear-gradient(180deg,rgba(30,30,34,.94),rgba(20,20,24,.94));
        border:1px solid rgba(255,255,255,.12);
        box-shadow:0 14px 34px rgba(0,0,0,.45), 0 2px 5px rgba(0,0,0,.3)}
  .bar{width:5px;border-radius:3px;background:${ACCENT}}
  .text{display:flex;flex-direction:column;justify-content:center}
  .title{font:600 25px/1.15 'Segoe UI',system-ui,sans-serif;color:#fff;
         letter-spacing:.1px;white-space:nowrap}
  </style></head><body><div class="card"><div class="bar"></div>
  <div class="text"><div class="title">${title}</div></div></div></body></html>`;
}

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

async function main() {
  const manifest = JSON.parse(await readFile(path.join(OUT, MANIFEST), 'utf8'));
  // Brand/interstitial scenes (`card: true`) are already full-frame artwork of their own.
  const wanted = manifest.scenes.filter((s) => s.title && !s.card);
  if (!wanted.length) {
    console.log('    no titled scenes — nothing to render');
    return;
  }
  await mkdir(CARDS, { recursive: true });

  const current = await readFile(INDEX, 'utf8').then(JSON.parse).catch(() => null);
  if (current && !FORCE && wanted.every((s) => current[s.id]?.title === s.title)) {
    console.log(`    ${Object.keys(current).length} title cards already present`);
    return;
  }

  const session = await launch({ width: 1600, height: 400, scale: SCALE, headless: true });
  const index = {};
  try {
    for (const scene of wanted) {
      const page = html(escapeHtml(scene.title));
      await session.navigate(`data:text/html;base64,${Buffer.from(page, 'utf8').toString('base64')}`);
      // Navigating resets this, so it has to be re-applied per page or the shot is opaque.
      await session.send('Emulation.setDefaultBackgroundColorOverride', {
        color: { r: 0, g: 0, b: 0, a: 0 },
      });
      const r = JSON.parse(await session.eval(`(() => {
        const b = document.querySelector('.card').getBoundingClientRect();
        return JSON.stringify({ x: b.x, y: b.y, w: b.width, h: b.height });
      })()`));

      const shot = await session.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
        clip: {
          x: Math.max(0, r.x - BLEED), y: Math.max(0, r.y - BLEED),
          width: r.w + BLEED * 2, height: r.h + BLEED * 2, scale: SCALE,
        },
      });
      const file = `titles/${scene.id}.png`;
      await writeFile(path.join(OUT, file), Buffer.from(shot.data, 'base64'));
      // Logical (1x) size — the filtergraph scales the 2x capture down to the output width.
      // `bleed` is the transparent shadow margin, which positioning has to allow for.
      index[scene.id] = {
        title: scene.title, file, bleed: BLEED,
        w: Math.round(r.w + BLEED * 2), h: Math.round(r.h + BLEED * 2),
      };
      console.log(`    ${scene.id.padEnd(24)} ${index[scene.id].w}x${index[scene.id].h}`);
    }
  } finally {
    await session.close();
  }

  await writeFile(INDEX, JSON.stringify(index, null, 2), 'utf8');
  console.log(`    ${Object.keys(index).length} title cards written`);
}

main();
