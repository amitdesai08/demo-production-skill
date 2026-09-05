// Stitches the narration into a single audio-only rendition of the track, with the same
// beats as the video.
//
//   node build-audio-track.mjs [--teaser] [--manifest other.json] [--out other]
//
// Two audiences for this file. Someone who cannot see the screen gets the whole walkthrough
// without it, and someone who simply wants to listen — on a commute, at a desk, in a room
// with no video — gets the same thing. Because it uses the shared timeline, it stays in step
// with the video and the captions rather than becoming a separate edit.

import { readFile, writeFile, mkdir, rm, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tool } from './lib/ffmpeg.mjs';
import { pickScenes } from './lib/track-timeline.mjs';
import { HOLD_AFTER_NARRATION, LEAD_IN_SILENCE } from './lib/timing.mjs';

// If a scene's point is carried by what is ON the screen rather than by what is said, record
// a described alternative for it and name it here. The rest of the track is untouched.
const DESCRIBED = {
  // '04-access': 'audio/ad-04-access.mp3',
};

const run = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'build');
const WORK = path.join(OUT, 'audio-track');

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1] : fallback;
};

// The silences have to match the narration's encoding exactly, or the pieces cannot be
// joined without re-encoding the whole track.
async function silence(ffmpeg, file, secs) {
  await run(ffmpeg, [
    '-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono',
    '-t', String(secs), '-c:a', 'libmp3lame', '-b:a', '96k', `"${file}"`,
  ], { shell: true });
  return file;
}

async function main() {
  const ffmpeg = await tool('ffmpeg');
  const manifest = JSON.parse(await readFile(path.join(OUT, arg('--manifest', 'scenes.json')), 'utf8'));
  const teaser = process.argv.includes('--teaser');
  const base = arg('--out', teaser ? 'walkthrough-teaser' : 'walkthrough');
  const scenes = await pickScenes(manifest, { teaser, scenesModule: arg('--scenes', 'scenes.mjs') });

  await rm(WORK, { recursive: true, force: true }).catch(() => {});
  await mkdir(WORK, { recursive: true });

  const lead = await silence(ffmpeg, path.join(WORK, 'lead.mp3'), LEAD_IN_SILENCE);
  const hold = await silence(ffmpeg, path.join(WORK, 'hold.mp3'), HOLD_AFTER_NARRATION);

  const lines = [];
  const add = (f) => lines.push(`file '${f.replace(/\\/g, '/')}'`);
  for (const scene of scenes) {
    const described = DESCRIBED[scene.id];
    if (described && !await stat(path.join(OUT, described)).catch(() => null)) {
      throw new Error(`described audio for ${scene.id} is listed but missing: ${described}`);
    }
    add(lead);
    add(path.join(OUT, described || scene.audio));
    add(hold);
  }

  const listFile = path.join(WORK, 'list.txt');
  await writeFile(listFile, lines.join('\n'), 'utf8');

  const outFile = path.join(OUT, `${base}.mp3`);
  await run(ffmpeg, [
    '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0',
    '-i', `"${listFile}"`, '-c', 'copy', `"${outFile}"`,
  ], { shell: true, maxBuffer: 1 << 24 });

  await rm(WORK, { recursive: true, force: true }).catch(() => {});

  const size = (await stat(outFile)).size;
  console.log(`${base}.mp3 — ${scenes.length} scenes, ${(size / 1024 / 1024).toFixed(1)} MB`);
}

main();
