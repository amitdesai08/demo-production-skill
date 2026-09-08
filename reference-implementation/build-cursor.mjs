// Renders the pointer used by the video's virtual cursor, once, to build/cursor.png.
//
//   node build-cursor.mjs [--force]
//
// Drawn as an SVG in the same headless browser the capture step already uses, rather than
// shipping a binary asset, so the shape stays editable and there is no new dependency. It is
// captured over a transparent background, which is what lets ffmpeg's overlay composite it
// onto a screenshot without a card around it.

import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './lib/cdp.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'build', 'cursor.png');

// Design size, for a 1920-wide frame; build-video.mjs scales it to the output width.
const W = 28;
const H = 45;

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 19" width="${W}" height="${H}">
  <defs>
    <filter id="s" x="-60%" y="-60%" width="240%" height="240%">
      <feDropShadow dx="0.35" dy="0.5" stdDeviation="0.45" flood-color="#000" flood-opacity="0.45"/>
    </filter>
  </defs>
  <path filter="url(#s)"
        d="M1,1 L1,17.2 L4.6,13.6 L7,18.6 L9.2,17.6 L6.9,12.8 L11,12.8 Z"
        fill="#ffffff" stroke="#1b1b1b" stroke-width="0.85" stroke-linejoin="round"/>
</svg>`;

async function main() {
  if (!process.argv.includes('--force')
    && await stat(OUT).then((s) => s.size > 0).catch(() => false)) {
    console.log('    cursor.png already present');
    return;
  }

  const html = `<!doctype html><html><body style="margin:0;background:transparent">${SVG}</body></html>`;
  const session = await launch({ width: W, height: H, scale: 2, headless: true });
  try {
    await session.navigate(`data:text/html;base64,${Buffer.from(html, 'utf8').toString('base64')}`);
    // Must come after navigation — navigating resets it, and without it the shot is opaque.
    await session.send('Emulation.setDefaultBackgroundColorOverride', {
      color: { r: 0, g: 0, b: 0, a: 0 },
    });
    await session.screenshot({ path: OUT });
  } finally {
    await session.close();
  }
  console.log(`    cursor.png written — ${W}x${H} at 2x`);
}

main();
