// Where every scene starts and ends in the finished track.
//
// Captions, the transcript and the audio-only rendition all have to agree with the video to
// the frame. The reliable way to get that is for none of them to work it out themselves:
// they all call this, which walks the same scenes in the same order with the same beats from
// lib/timing.mjs and measures each clip with ffprobe rather than trusting the manifest's
// rounded estimate. A caption file that computes its own timeline drifts a little further
// out of step with every scene, and the error is only visible near the end.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tool, seconds } from './ffmpeg.mjs';
import { HOLD_AFTER_NARRATION, LEAD_IN_SILENCE } from './timing.mjs';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'build');

// Returns [{ scene, start, end, sceneEnd }] in seconds, where start/end bracket the spoken
// audio and sceneEnd is the cut point after the held beat.
export async function timeline(scenes) {
  const ffprobe = await tool('ffprobe');
  const rows = [];
  let t = 0;
  for (const scene of scenes) {
    const dur = await seconds(ffprobe, path.join(OUT, scene.audio));
    const start = t + LEAD_IN_SILENCE;
    rows.push({ scene, start, end: start + dur, sceneEnd: start + dur + HOLD_AFTER_NARRATION });
    t += LEAD_IN_SILENCE + dur + HOLD_AFTER_NARRATION;
  }
  return rows;
}

// The scenes a cut actually contains. The video and the caption files must select scenes the
// same way or the captions describe a different cut of the same material, so both call this
// rather than filtering the manifest themselves.
export async function pickScenes(manifest, { teaser = false, scenesModule = 'scenes.mjs' } = {}) {
  let ids = (process.env.DEMO_TEASER_SCENES || '').split(',').map((s) => s.trim()).filter(Boolean);

  if (teaser && !ids.length) {
    // Fall back to whatever the scenes file itself declared, then to a generic heuristic.
    ids = await import(`../${scenesModule}`).then((m) => m.TEASER_SCENES || []).catch(() => []);
  }
  if (teaser && !ids.length) {
    const all = manifest.scenes.map((s) => s.id);
    ids = all.filter((_, n) => n === 0 || n === all.length - 1 || n % 3 === 0);
    console.log('  no teaser scene list configured — falling back to a generic every-3rd-scene cut');
  }

  const scenes = manifest.scenes.filter((s) => s.image && s.audio && (!teaser || ids.includes(s.id)));
  if (!scenes.length) throw new Error('nothing to build — run capture.mjs and narrate.mjs first');
  return scenes;
}
