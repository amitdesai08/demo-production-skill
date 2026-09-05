// Turns each scene's narration into an MP3 (+ a WebM/Opus fallback) with Azure AI Speech,
// and records the exact time every word is spoken.
//
//   node narrate.mjs                 synthesise anything missing
//   node narrate.mjs --force         redo everything (required after editing an EXISTING
//                                    scene's text — see pipeline-reference.md)
//   node narrate.mjs --print-ssml 03-scene-id   print the markup for one scene and exit
//
// This uses the Speech SDK rather than the plain REST endpoint for one reason: the SDK
// raises a `wordBoundary` event per word as it synthesises, and REST does not. Those
// timestamps are written next to the audio as `<scene-id>.words.json` and are what let
// captions and on-screen highlights be placed against the voice instead of estimated from
// word counts — estimates drift audibly within a single long scene.
//
// This is also the file responsible for how natural the delivery sounds. Read the comment
// on ssml() before adding shaping rules; the pause policy there is the result of measuring
// the output, not taste.
//
// ── Authentication — two supported modes ────────────────────────────────────
//
// Mode 1 (default, works with any standard Azure AI Speech resource): a subscription key.
//   $env:SPEECH_KEY = '<your Speech resource key>'
//   $env:SPEECH_REGION = '<e.g. eastus>'
//
// Mode 2 (for a Speech resource with local/key auth disabled, i.e. Entra-only): an Azure CLI
// token, exchanged for the special `aad#{resourceId}#{token}` form Speech expects. This
// needs `az login` already done, the caller to hold "Cognitive Services Speech User" on the
// resource (a subscription Owner role does NOT inherit data-plane access), and:
//   $env:SPEECH_RESOURCE = '<resource name>'
//   $env:SPEECH_RESOURCE_GROUP = '<resource group>'
//   $env:SPEECH_REGION = '<e.g. eastus>'
//   (leave SPEECH_KEY unset to select this mode)

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { applyPronunciations } from './lib/pronunciation.mjs';

const run = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'build');
const AUDIO = path.join(OUT, 'audio');

const KEY = process.env.SPEECH_KEY || '';
const RESOURCE = process.env.SPEECH_RESOURCE || '';
const RESOURCE_GROUP = process.env.SPEECH_RESOURCE_GROUP || '';
const REGION = process.env.SPEECH_REGION;
if (!REGION) throw new Error('set SPEECH_REGION (e.g. eastus) before running narrate.mjs');

// A neutral voice by default — pick one your audience won't notice as an accent choice
// before they notice the product. Full voice list: az cognitiveservices account list-voices.
const VOICE = process.env.DEMO_VOICE || 'en-US-AndrewNeural';
// Slightly above natural pace reads as confident without feeling rushed. Tune per voice.
const RATE = process.env.DEMO_RATE || '+2%';
const PITCH = process.env.DEMO_PITCH || '+0%';
const STYLE = process.env.DEMO_STYLE || 'narration-professional';
// How far to push the speaking style past the voice's default read. Around 1.15 keeps
// audible rise and fall; higher starts stressing words the sense doesn't call for, which is
// heard as odd emphasis rather than expression.
const STYLE_DEGREE = process.env.DEMO_STYLE_DEGREE || '1.15';
const FORCE = process.argv.includes('--force');
const PRINT_SSML = (() => {
  const i = process.argv.indexOf('--print-ssml');
  return i > -1 ? (process.argv[i + 1] || true) : null;
})();
const MANIFEST = (() => {
  const i = process.argv.indexOf('--manifest');
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1] : 'scenes.json';
})();

const FORMATS = [
  { ext: 'mp3', format: sdk.SpeechSynthesisOutputFormat.Audio24Khz96KBitRateMonoMp3, kbps: 96, primary: true },
  // Some Chromium builds (and Electron/VS Code's own browser) lack an MP3 decoder and report
  // it via a silent playback failure rather than an error — ship an Opus fallback the player
  // can switch to if the primary format's <audio> element fires an `error` event.
  { ext: 'webm', format: sdk.SpeechSynthesisOutputFormat.Webm24Khz16Bit24KbpsMonoOpus, kbps: 24, primary: false },
];

async function az(args) {
  const { stdout } = await run('az', args, { shell: true });
  return stdout.trim();
}

async function speechAuth() {
  if (KEY) return { mode: 'key', value: KEY };
  if (!RESOURCE || !RESOURCE_GROUP) {
    throw new Error('set SPEECH_KEY, or SPEECH_RESOURCE + SPEECH_RESOURCE_GROUP for AAD auth');
  }
  const resourceId = await az([
    'cognitiveservices', 'account', 'show',
    '-n', RESOURCE, '-g', RESOURCE_GROUP, '--query', 'id', '-o', 'tsv',
  ]);
  const token = JSON.parse(await az([
    'account', 'get-access-token', '--resource', 'https://cognitiveservices.azure.com', '-o', 'json',
  ])).accessToken;
  if (!resourceId || !token) throw new Error(`could not authenticate to ${RESOURCE}. Run 'az login' first.`);
  return { mode: 'aad', value: `aad#${resourceId}#${token}` };
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

// Sentence boundaries, graded. Both extremes were measured on real output and both were
// wrong: forcing a uniform break at every sentence landed them all at ~0.67s, and leaving
// the boundary entirely to the voice landed them all at ~0.29s, which runs sentences
// together. The fault in both cases was UNIFORMITY, not the length. So an ordinary boundary
// gets a short beat, and the scene's closing sentence — the line the whole scene has been
// building to — gets a longer one to land on.
const SENTENCE_BREAK = Number(process.env.DEMO_SENTENCE_BREAK_MS || 180);
const CLOSING_BREAK = Number(process.env.DEMO_CLOSING_BREAK_MS || 420);

function stageSentences(s) {
  const boundaries = [...s.matchAll(/([.!?])(\s+)(?=[A-Z&])/g)];
  if (!boundaries.length) return s;
  let out = '';
  let from = 0;
  boundaries.forEach((m, i) => {
    const ms = i === boundaries.length - 1 ? CLOSING_BREAK : SENTENCE_BREAK;
    out += `${s.slice(from, m.index + 1)}<break time="${ms}ms"/> `;
    from = m.index + m[0].length;
  });
  return out + s.slice(from);
}

// A scene may carry its own delivery overrides — `voice` ({ rate, pitch, style,
// styleDegree }) to lift an opening line, and `ssmlBody` to hand-shape the few lines worth
// marking up by hand. `say` always keeps the plain wording, because captions and the
// transcript read from it.
function ssml(text, { voice = {}, ssmlBody } = {}) {
  const rate = voice.rate || RATE;
  const pitch = voice.pitch || PITCH;
  const style = voice.style || STYLE;
  const styleDegree = voice.styleDegree || STYLE_DEGREE;

  // Beyond the graded sentence beat, only real authorial marks get time: an em dash, which
  // the voice otherwise runs straight through as if the words either side were one clause,
  // and a colon, which introduces what follows. Section-level beats are not made here at
  // all — they are the silence between scenes (see lib/timing.mjs).
  const shaped = ssmlBody || stageSentences(applyPronunciations(esc(text)))
    .replace(/\s+\u2014\s+/g, '<break time="160ms"/> ')
    .replace(/:\s+/g, ':<break time="120ms"/> ');

  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" `
    + `xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${VOICE.slice(0, 5)}">`
    + `<voice name="${VOICE}"><mstts:express-as style="${style}" styledegree="${styleDegree}">`
    + `<prosody rate="${rate}" pitch="${pitch}">${shaped}</prosody>`
    + `</mstts:express-as></voice></speak>`;
}

function speechConfigFor(auth, format) {
  const cfg = auth.mode === 'key'
    ? sdk.SpeechConfig.fromSubscription(auth.value, REGION)
    // The SDK adds its own transport header from this raw token, so no 'Bearer ' prefix.
    : sdk.SpeechConfig.fromAuthorizationToken(auth.value, REGION);
  cfg.speechSynthesisOutputFormat = format;
  return cfg;
}

// Synthesises one scene's line. For the primary format it also captures every word's and
// punctuation mark's start time and duration, in seconds from the start of this clip, from
// the engine's own `wordBoundary` events — the ground truth captions and highlights use.
async function synthesise(auth, scene, outPath, fmt) {
  const synthesizer = new sdk.SpeechSynthesizer(
    speechConfigFor(auth, fmt.format),
    sdk.AudioConfig.fromAudioFileOutput(outPath),
  );

  const words = [];
  if (fmt.primary) {
    synthesizer.wordBoundary = (_s, e) => {
      const kind = e.boundaryType === 'PunctuationBoundary' ? 'punct' : 'word';
      // The engine sometimes reports a punctuation boundary whose text is the whole
      // remaining span of the line rather than the mark itself, with timings that run
      // backwards. Left in, it becomes a caption cue holding the rest of the scene, shown
      // for a few milliseconds. Every word it covers also arrives as its own event.
      if (kind === 'punct' && e.text.trim().length > 3) return;
      words.push({
        text: e.text,
        kind,
        start: e.audioOffset / 1e7, // 100-nanosecond ticks
        dur: e.duration / 1e7,
      });
    };
  }

  const result = await new Promise((resolve, reject) => {
    synthesizer.speakSsmlAsync(
      ssml(scene.say, scene),
      (r) => { synthesizer.close(); resolve(r); },
      (err) => { synthesizer.close(); reject(new Error(err)); },
    );
  });
  if (result.reason !== sdk.ResultReason.SynthesizingAudioCompleted) {
    throw new Error(`speech synthesis failed: ${result.errorDetails || result.reason}`);
  }
  return { bytes: (await stat(outPath)).size, words };
}

async function main() {
  const manifestPath = path.join(OUT, MANIFEST);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  await mkdir(AUDIO, { recursive: true });

  // Check the markup before spending Speech calls on it — a phoneme entry that matched more
  // than intended, or hand-written ssmlBody with a stray tag, is visible here.
  if (PRINT_SSML) {
    const wanted = typeof PRINT_SSML === 'string' ? [PRINT_SSML] : manifest.scenes.map((s) => s.id);
    for (const scene of manifest.scenes.filter((s) => wanted.includes(s.id))) {
      console.log(`\n── ${scene.id} ──\n${ssml(scene.say, scene)}`);
    }
    return;
  }

  const auth = await speechAuth();
  let made = 0, kept = 0;

  for (const scene of manifest.scenes) {
    const wordsFile = path.join(AUDIO, `${scene.id}.words.json`);

    for (const f of FORMATS) {
      const file = `${scene.id}.${f.ext}`;
      const abs = path.join(AUDIO, file);
      const size = await stat(abs).then((st) => st.size).catch(() => 0);
      // A clip recorded before word capture existed has no sidecar; treat it as missing so
      // it is re-recorded rather than leaving that one scene without caption timings.
      const haveWords = !f.primary || await stat(wordsFile).then(() => true).catch(() => false);
      const key = f.primary ? 'audio' : 'audioAlt';

      if (size > 0 && haveWords && !FORCE) {
        // Re-capturing rewrites the manifest, so restate these rather than leaving the
        // player without them. This does NOT re-check whether scene.say changed — see the
        // --force gotcha documented at the top of this file and in the skill's
        // pipeline-reference.md.
        scene[key] = `audio/${file}`;
        if (f.primary) {
          scene.seconds = Math.round((size * 8) / (f.kbps * 1000));
          scene.words = JSON.parse(await readFile(wordsFile, 'utf8'));
        }
        kept++;
        continue;
      }

      const { bytes, words } = await synthesise(auth, scene, abs, f);
      scene[key] = `audio/${file}`;
      if (f.primary) {
        await writeFile(wordsFile, JSON.stringify(words), 'utf8');
        scene.words = words;
        scene.seconds = Math.round((bytes * 8) / (f.kbps * 1000));
        console.log(`  ${scene.id.padEnd(24)} ${String(Math.round(bytes / 1024)).padStart(4)}KB  `
          + `~${scene.seconds}s  ${words.length} timed tokens`);
      }
      made++;
    }
  }

  manifest.voice = VOICE;
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  const total = manifest.scenes.reduce((a, s) => a + (s.seconds || 0), 0);
  console.log(`\n${made} synthesised, ${kept} already present`);
  console.log(`narration runs about ${Math.round(total / 60)} minutes in ${VOICE}`);
}

main();
