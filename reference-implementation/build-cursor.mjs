// Renders the video's pointer art, once, to build/cursor.png and build/click-ring.png.
//
//   node build-cursor.mjs [--force]
//
// Drawn as SVG in the same headless browser the capture step already uses, rather than
// shipping binary assets, so the shapes stay editable and there is no new dependency. Both
// are screenshotted with the page background overridden to fully transparent, which is what
// lets ffmpeg's overlay composite them onto a screenshot without a card around them.
//
// The ring is what makes the pointer read as *using* the product rather than floating over
// it: build-video.mjs grows and fades it at the moment of each click.

import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './lib/cdp.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'build');

// Shared with the video's highlight colour, converted from ffmpeg's 0xRRGGBB to CSS.
const ACCENT = `#${(process.env.DEMO_VIDEO_ACCENT || '0x4F6BED').replace(/^0x/, '')}`;

// Design size for a 1920-wide frame, close to a real pointer at that scale; build-video.mjs
// scales it to the output width. Larger than this reads as a presentation prop.
const CURSOR_W = 20;
const CURSOR_H = 32;
// Rendered large, then scaled per frame by the filtergraph as the ripple expands.
const RING = 120;

const CURSOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 19" width="${CURSOR_W}" height="${CURSOR_H}">
  <defs>
    <filter id="s" x="-60%" y="-60%" width="240%" height="240%">
      <feDropShadow dx="0.35" dy="0.5" stdDeviation="0.45" flood-color="#000" flood-opacity="0.5"/>
    </filter>
  </defs>
  <path filter="url(#s)"
        d="M1,1 L1,17.2 L4.6,13.6 L7,18.6 L9.2,17.6 L6.9,12.8 L11,12.8 Z"
        fill="#ffffff" stroke="#1b1b1b" stroke-width="0.9" stroke-linejoin="round"/>
</svg>`;

const RING_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${RING}" height="${RING}">
  <circle cx="50" cy="50" r="34" fill="${ACCENT}" fill-opacity="0.16"
          stroke="${ACCENT}" stroke-opacity="0.95" stroke-width="7"/>
</svg>`;

async function shoot(session, svg, file) {
  const html = `<!doctype html><html><body style="margin:0;background:transparent">${svg}</body></html>`;
  await session.navigate(`data:text/html;base64,${Buffer.from(html, 'utf8').toString('base64')}`);
  // Must come after navigation — navigating resets it, and without it the shot is opaque.
  await session.send('Emulation.setDefaultBackgroundColorOverride', {
    color: { r: 0, g: 0, b: 0, a: 0 },
  });
  await session.screenshot({ path: path.join(OUT, file) });
}

async function main() {
  const have = async (f) => stat(path.join(OUT, f)).then((s) => s.size > 0).catch(() => false);
  if (!process.argv.includes('--force') && await have('cursor.png') && await have('click-ring.png')) {
    console.log('    cursor art already present');
    return;
  }

  const session = await launch({ width: RING, height: RING, scale: 2, headless: true });
  try {
    await shoot(session, CURSOR_SVG, 'cursor.png');
    await shoot(session, RING_SVG, 'click-ring.png');
  } finally {
    await session.close();
  }
  console.log(`    cursor.png (${CURSOR_W}x${CURSOR_H}) + click-ring.png written`);
}

main();
