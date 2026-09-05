// Renders the scenes to an MP4, for the one kind of embedding GitHub (and most markdown
// renderers) permit.
//
//   node build-video.mjs              the whole walkthrough
//   node build-video.mjs --teaser     a short cut, e.g. for a README
//
// GitHub's markdown sanitiser strips <audio>, <iframe>, <embed> and every <script>, so an
// interactive HTML player can never run inside a README. It does keep <video src controls>,
// and raw.githubusercontent serves .mp4 as video/mp4 — so a narrated video committed to the
// repo plays inline on the front page. That is the whole reason this file exists.
//
// Needs ffmpeg + ffprobe on PATH, or point DEMO_FFMPEG / DEMO_FFPROBE at a portable build:
//   winget install Gyan.FFmpeg
//   or unzip https://github.com/BtbN/FFmpeg-Builds/releases/latest and set the env vars.

import { readFile, writeFile, mkdir, rm, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tool, seconds, imageSize } from './lib/ffmpeg.mjs';
import { pickScenes } from './lib/track-timeline.mjs';
import { HOLD_AFTER_NARRATION, LEAD_IN_SILENCE } from './lib/timing.mjs';
import { SPOTLIGHT_CUES, findPhrase } from './lib/spotlight-cues.mjs';

const run = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'build');
const SEGS = path.join(OUT, 'segments');

const TEASER = process.argv.includes('--teaser');
// The scene ids that carry the whole story alone, for the --teaser cut. Configure this per
// project — either set DEMO_TEASER_SCENES as a comma-separated list of scene ids, or export
// TEASER_SCENES from your scenes.mjs file. If neither is set and --teaser is requested, this
// falls back to a generic heuristic: the first scene, the last scene, and every third one
// in between — reasonable, but a hand-picked list almost always tells a better short story.
// The selection itself lives in lib/track-timeline.mjs so the caption files cut identically.

const WIDTH = Number(process.env.DEMO_VIDEO_WIDTH || 1440);
const CRF = Number(process.env.DEMO_VIDEO_CRF || 26);
// Chapter titles and highlight labels. Any TTF on the machine works; this one ships with
// Windows. Set DEMO_VIDEO_FONT to override, or DEMO_VIDEO_TITLES=0 to render without them.
const FONT = (process.env.DEMO_VIDEO_FONT || 'C:/Windows/Fonts/segoeuisl.ttf')
  .replace(/\\/g, '/').replace(/:/g, '\\:');
const TITLES = process.env.DEMO_VIDEO_TITLES !== '0';
const TITLE_SECONDS = Number(process.env.DEMO_VIDEO_TITLE_SECONDS || 3.4);
const ACCENT = process.env.DEMO_VIDEO_ACCENT || '0x4F6BED';

// ── What ffmpeg filter expressions can and cannot do here ───────────────────────
//
// Verified on this pipeline by rendering each case in isolation and reading the pixels back,
// because every failure mode here is SILENT — the filter draws nothing, or draws in the
// wrong place, and ffmpeg reports success even at -loglevel warning.
//
//   1. In drawbox, `t` inside an x/y/w/h expression is NOT the timestamp — `t` is that
//      filter's own `thickness` option, which shadows it. A box whose x is
//      '10+300*clip(t/3,0,1)' does not move: measured at 0.1s and at 2.9s it sat at the same
//      pixel both times. So a drawbox CANNOT animate on time. Change its visibility with
//      `enable=`, where `t` really is the timestamp, and leave its geometry constant.
//
//   2. In drawtext, `t` IS the timestamp: the same expression moved the glyph from x=24 to
//      x=303 between those two frames. Anything that genuinely needs to move has to be
//      drawn as text.
//
// The practical consequence, and the reason the title below appears rather than slides: a
// plate and its label must move together, and the plate cannot move at all.
//
//   3. A nested if() used as another if()'s FALSE branch is mis-evaluated. Prefer
//      clip(x, 0, 1) arithmetic over branching on time.

// ffmpeg splits filters on commas and options on colons, so anything that appears inside an
// expression or a literal has to be escaped out of that syntax first.
const expr = (s) => s.replace(/,/g, '\\,');
const literal = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/:/g, '\\:')
  .replace(/%/g, '\\%');

// A chapter card naming the section, shown while the scene is introduced and then cleared so
// the rest of it is unobstructed. It appears and disappears rather than sliding: the plate
// behind the text is a drawbox, and a drawbox cannot animate on time (see note 1 above), so
// an animated label would slide out of its own background.
function titleOverlay(title, W, H) {
  const k = W / 1920;
  const size = Math.max(14, Math.round(30 * k));
  const padX = Math.round(28 * k);
  const padY = Math.round(18 * k);
  const margin = Math.round(56 * k);
  // drawbox cannot measure the text, so size the plate from the string. 0.55em per character
  // is a close enough average for a UI sans at this weight.
  const boxW = Math.round(padX * 2 + size * 0.55 * title.length);
  const boxH = size + padY * 2;
  const y = H - margin - boxH;
  const bar = Math.max(3, Math.round(6 * k));
  const x = margin;
  const on = expr(`between(t,0,${TITLE_SECONDS})`);

  return [
    `drawbox=x=${x}:y=${y}:w=${boxW}:h=${boxH}:color=0x1B1B1B@0.88:t=fill:enable='${on}'`,
    `drawbox=x=${x}:y=${y}:w=${bar}:h=${boxH}:color=${ACCENT}@1:t=fill:enable='${on}'`,
    `drawtext=fontfile='${FONT}':text='${literal(title)}':fontcolor=white:fontsize=${size}`
      + `:x=${x + padX + bar}:y=${y + padY}:enable='${on}'`,
  ];
}

// Outlines the region being talked about, for as long as it is being talked about.
function spotlightOverlay(spots, W, H) {
  const k = W / 1920;
  const inset = Math.max(2, Math.round(3 * k));
  const weight = Math.max(2, Math.round(4 * k));
  const filters = [];

  for (const spot of spots) {
    // A captured rect can start off-screen or run past the edge after scrolling, and a box
    // drawn partly outside the frame is dropped entirely rather than clipped.
    const bx = Math.max(inset, Math.round(spot.rect.x));
    const by = Math.max(inset, Math.round(spot.rect.y));
    const bw = Math.min(Math.round(spot.rect.w), W - bx - inset);
    const bh = Math.min(Math.round(spot.rect.h), H - by - inset);
    if (bw < 40 || bh < 40) continue;

    filters.push(`drawbox=x=${bx}:y=${by}:w=${bw}:h=${bh}:color=${ACCENT}@0.95`
      + `:t=${weight}:enable='${expr(`between(t,${spot.start.toFixed(2)},${spot.end.toFixed(2)})`)}'`);
  }
  return filters;
}

// Places each highlight at the moment its phrase is spoken. Falls back to showing it for the
// whole scene when the project has not configured a cue for it.
function planSpotlights(scene, sceneSeconds, scaleRect) {
  const rects = (scene.spotlights || (scene.spotlight ? [scene.spotlight] : [])).map(scaleRect);
  if (!rects.length) return [];

  const narrationEnd = sceneSeconds - HOLD_AFTER_NARRATION;
  const cues = SPOTLIGHT_CUES[scene.id] || [];
  const spots = rects.map((rect, i) => {
    const phrase = cues[i];
    const hit = phrase && scene.words ? findPhrase(scene.words, phrase) : null;
    if (phrase && !hit) {
      // Loud on purpose: an edit reworded the line, so this highlight has quietly gone back
      // to appearing at the top of the scene. A person has to choose the new phrase.
      console.log(`  ! ${scene.id}: cue "${phrase}" is no longer spoken in this scene — `
        + `re-anchor it in lib/spotlight-cues.mjs`);
    }
    // Come up just before the phrase lands, and stay up through the explanation of it.
    // With no cue, fall back to spreading the regions evenly across the scene: giving them
    // all the same start would make each one cut the previous one off at zero length.
    const spread = 0.3 + (i * Math.max(0, narrationEnd - 0.3)) / rects.length;
    const start = hit ? Math.max(0.3, LEAD_IN_SILENCE + hit.start - 0.35) : spread;
    return { rect, start, end: narrationEnd + 0.3 };
  }).sort((a, b) => a.start - b.start);

  // One region at a time: each gives way to the next rather than accumulating boxes.
  for (const [i, spot] of spots.entries()) {
    const next = spots[i + 1];
    if (next) spot.end = Math.min(spot.end, next.start - 0.25);
    spot.end = Math.min(spot.end, sceneSeconds - 0.2);
  }
  return spots.filter((s) => s.end > s.start + 0.3);
}

async function main() {
  const ffmpeg = await tool('ffmpeg');
  const ffprobe = await tool('ffprobe');

  const arg = (flag, fallback) => {
    const i = process.argv.indexOf(flag);
    return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
      ? process.argv[i + 1] : fallback;
  };
  const manifestName = arg('--manifest', 'scenes.json');
  const outName = arg('--out', TEASER ? 'walkthrough-teaser.mp4' : 'walkthrough.mp4');

  const manifest = JSON.parse(await readFile(path.join(OUT, manifestName), 'utf8'));
  const scenes = await pickScenes(manifest, { teaser: TEASER, scenesModule: arg('--scenes', 'scenes.mjs') });

  await rm(SEGS, { recursive: true, force: true }).catch(() => {});
  await mkdir(SEGS, { recursive: true });

  // The screenshots are scaled to the output width, so the highlight rectangles measured in
  // the browser have to be scaled by the same factor before they will land on anything.
  const src = await imageSize(ffprobe, path.join(OUT, scenes[0].image));
  const outH = Math.round((WIDTH * src.h) / src.w / 2) * 2;
  const rectScale = WIDTH / (manifest.viewport?.width || src.w);
  const scaleRect = (r) => ({
    x: r.x * rectScale, y: r.y * rectScale, w: r.w * rectScale, h: r.h * rectScale,
  });

  let total = 0;
  const list = [];

  for (const [n, scene] of scenes.entries()) {
    const seg = path.join(SEGS, `${String(n).padStart(2, '0')}-${scene.id}.mp4`);
    const dur = await seconds(ffprobe, path.join(OUT, scene.audio));
    // Silence before the scene speaks and a held beat after it stops. Without the lead-in,
    // the cut and the next line land on the same frame and the whole piece reads as one
    // continuous take over changing pictures instead of a series of points.
    const hold = (LEAD_IN_SILENCE + dur + HOLD_AFTER_NARRATION).toFixed(2);
    total += Number(hold);

    const filters = [`scale=${WIDTH}:-2:flags=lanczos`];
    filters.push(...spotlightOverlay(planSpotlights(scene, Number(hold), scaleRect), WIDTH, outH));
    if (TITLES && scene.title) filters.push(...titleOverlay(scene.title, WIDTH, outH));
    filters.push('format=yuv420p');

    await run(ffmpeg, [
      '-y', '-loglevel', 'error',
      '-loop', '1', '-framerate', '10', '-i', `"${path.join(OUT, scene.image)}"`,
      '-i', `"${path.join(OUT, scene.audio)}"`,
      '-t', hold,
      '-vf', `"${filters.join(',')}"`,
      // Delay the voice rather than padding the file, so the lead-in silence is real audio
      // and the segments still concatenate without a gap.
      '-af', `"adelay=${Math.round(LEAD_IN_SILENCE * 1000)}:all=1"`,
      '-c:v', 'libx264', '-preset', 'veryslow', '-crf', String(CRF), '-tune', 'stillimage',
      // The frame never changes within a scene, so a long keyframe interval costs nothing
      // to look at and saves most of the file. At a 2s GOP this was three times the size.
      '-r', '10', '-g', '600', '-keyint_min', '600', '-sc_threshold', '0',
      '-c:a', 'aac', '-b:a', '96k', '-ar', '44100', '-ac', '2',
      '-movflags', '+faststart',
      `"${seg}"`,
    ], { shell: true, maxBuffer: 1 << 24 });

    list.push(`file '${seg.replace(/\\/g, '/')}'`);
    process.stdout.write(`  ${scene.id.padEnd(24)} ${hold.padStart(6)}s\n`);
  }

  const listFile = path.join(SEGS, 'list.txt');
  await writeFile(listFile, list.join('\n'), 'utf8');

  const outFile = path.join(OUT, outName);
  await run(ffmpeg, [
    '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0',
    '-i', `"${listFile}"`, '-c', 'copy', '-movflags', '+faststart', `"${outFile}"`,
  ], { shell: true, maxBuffer: 1 << 24 });

  await rm(SEGS, { recursive: true, force: true }).catch(() => {});

  const size = (await stat(outFile)).size;
  const mins = Math.floor(total / 60), secs = Math.round(total % 60);
  console.log(`\n${path.basename(outFile)} — ${scenes.length} scenes, ${mins}m ${secs}s, `
    + `${(size / 1024 / 1024).toFixed(1)} MB`);
  console.log(outFile);
}

main();
