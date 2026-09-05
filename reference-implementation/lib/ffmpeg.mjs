// Locating ffmpeg/ffprobe and asking them about a file. Shared so the video, the captions
// and the audio track all measure scene lengths the same way.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const run = promisify(execFile);

export async function tool(name) {
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

export async function seconds(ffprobe, file) {
  const { stdout } = await run(ffprobe, [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', `"${file}"`,
  ], { shell: true });
  const d = parseFloat(stdout.trim());
  if (!Number.isFinite(d)) throw new Error(`could not read a duration from ${file}`);
  return d;
}

export async function imageSize(ffprobe, file) {
  const { stdout } = await run(ffprobe, [
    '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height',
    '-of', 'csv=s=x:p=0', `"${file}"`,
  ], { shell: true });
  const [w, h] = stdout.trim().split('x').map(Number);
  if (!w || !h) throw new Error(`could not read dimensions from ${file}`);
  return { w, h };
}
