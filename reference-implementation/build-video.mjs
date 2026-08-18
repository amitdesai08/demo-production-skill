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
let TEASER_SCENES = (process.env.DEMO_TEASER_SCENES || '').split(',').map((s) => s.trim()).filter(Boolean);

const WIDTH = Number(process.env.DEMO_VIDEO_WIDTH || 1440);
const CRF = Number(process.env.DEMO_VIDEO_CRF || 26);

async function tool(name) {
  const fromEnv = process.env[`DEMO_${name.toUpperCase()}`];
  if (fromEnv) return fromEnv;
  const candidates = [
    name,
    path.join(process.env.TEMP || '/tmp', 'ffmpeg', 'ffmpeg-master-latest-win64-gpl', 'bin', `${name}.exe`),
  ];
  for (const c of candidates) {
    try { await run(c, ['-version'], { shell: true }); return c; } catch { /* next */ }
  }
  throw new Error(`${name} not found. Install it (winget install Gyan.FFmpeg) or set DEMO_${name.toUpperCase()}.`);
}

async function seconds(ffprobe, file) {
  const { stdout } = await run(ffprobe, [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', `"${file}"`,
  ], { shell: true });
  const d = parseFloat(stdout.trim());
  if (!Number.isFinite(d)) throw new Error(`could not read a duration from ${file}`);
  return d;
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

  if (TEASER && !TEASER_SCENES.length) {
    // Fall back to whatever the scenes file itself declared, then to a generic heuristic.
    const scenesModuleName = arg('--scenes', 'scenes.mjs');
    TEASER_SCENES = await import(`./${scenesModuleName}`).then((m) => m.TEASER_SCENES || []).catch(() => []);
  }
  if (TEASER && !TEASER_SCENES.length) {
    const ids = manifest.scenes.map((s) => s.id);
    TEASER_SCENES = ids.filter((_, n) => n === 0 || n === ids.length - 1 || n % 3 === 0);
    console.log('  no teaser scene list configured — falling back to a generic every-3rd-scene cut');
  }

  const scenes = manifest.scenes.filter((s) => s.image && s.audio
    && (!TEASER || TEASER_SCENES.includes(s.id)));
  if (!scenes.length) throw new Error('nothing to render — run capture.mjs and narrate.mjs first');

  await rm(SEGS, { recursive: true, force: true }).catch(() => {});
  await mkdir(SEGS, { recursive: true });

  let total = 0;
  const list = [];

  for (const [n, scene] of scenes.entries()) {
    const seg = path.join(SEGS, `${String(n).padStart(2, '0')}-${scene.id}.mp4`);
    const dur = await seconds(ffprobe, path.join(OUT, scene.audio));
    // A held beat after the narration stops, so scenes do not cut on the speaker's last
    // syllable the way they do in the player, where a cursor covers the gap.
    const hold = (dur + 0.7).toFixed(2);
    total += Number(hold);

    await run(ffmpeg, [
      '-y', '-loglevel', 'error',
      '-loop', '1', '-framerate', '10', '-i', `"${path.join(OUT, scene.image)}"`,
      '-i', `"${path.join(OUT, scene.audio)}"`,
      '-t', hold,
      '-vf', `"scale=${WIDTH}:-2:flags=lanczos,format=yuv420p"`,
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
