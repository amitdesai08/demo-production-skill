// Turns each scene's narration into an MP3 (+ a WebM/Opus fallback) with Azure AI Speech.
//
//   node narrate.mjs           synthesise anything missing
//   node narrate.mjs --force   redo everything (required after editing an EXISTING scene's
//                              text — see the pipeline-reference.md gotcha in the skill docs)
//
// This is the file responsible for "the same quality of language processing" as the reference
// tracks: a calibrated voice, rate and speaking style, and one deliberate SSML shaping rule
// (an em-dash becomes a short pause; nothing else does — see the comment on ssml() below).
// Do not add more SSML shaping without re-reading that comment; more break tags than this
// stacks on top of the voice's own pacing and reads as hesitation, not speech.
//
// ── Authentication — two supported modes ────────────────────────────────────
//
// Mode 1 (default, works with any standard Azure AI Speech resource): a subscription key.
//   $env:SPEECH_KEY = '<your Speech resource key>'
//   $env:SPEECH_REGION = '<e.g. eastus>'
//
// Mode 2 (for a Speech resource with local/key auth disabled, i.e. Entra-only): an Azure CLI
// token, exchanged for the special `aad#{resourceId}#{token}` bearer form Speech expects. This
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
const STYLE = process.env.DEMO_STYLE || 'narration-professional';
const FORCE = process.argv.includes('--force');
const MANIFEST = (() => {
  const i = process.argv.indexOf('--manifest');
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1] : 'scenes.json';
})();

const FORMATS = [
  { ext: 'mp3', spec: 'audio-24khz-96kbitrate-mono-mp3', kbps: 96, primary: true },
  // Some Chromium builds (and Electron/VS Code's own browser) lack an MP3 decoder and report
  // it via a silent playback failure rather than an error — ship an Opus fallback the player
  // can switch to if the primary format's <audio> element fires an `error` event.
  { ext: 'webm', spec: 'webm-24khz-16bit-mono-opus', kbps: 24, primary: false },
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

// Optional: a name a generic voice will mispronounce by guesswork. Add entries as
// { Name: 'IPA pronunciation' } — leave empty if this doesn't apply to your content.
const NAME_PHONEMES = {};

function pronounceNames(s) {
  for (const [name, ph] of Object.entries(NAME_PHONEMES)) {
    s = s.replaceAll(name, `<phoneme alphabet="ipa" ph="${ph}">${name}</phoneme>`);
  }
  return s;
}

function ssml(text) {
  // A forced break after every period stacks on top of the neural voice's own sentence-final
  // pause and reads as hesitation, closer to a list being read aloud than a person talking.
  // The voice already paces sentence and clause boundaries on its own; the only place it
  // needs help is an em dash, which it otherwise runs straight through as if the words either
  // side were one clause. See references/narration-style.md in the skill docs for why em-dash
  // FREQUENCY in your scene text is itself something to keep deliberately low, not just this
  // one substitution rule.
  const shaped = pronounceNames(esc(text))
    .replace(/\s+\u2014\s+/g, '<break time="120ms"/> ');
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" `
    + `xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${VOICE.slice(0, 5)}">`
    + `<voice name="${VOICE}"><mstts:express-as style="${STYLE}">`
    + `<prosody rate="${RATE}">${shaped}</prosody>`
    + `</mstts:express-as></voice></speak>`;
}

async function synthesise(auth, text, outPath, format) {
  const endpoint = `https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const headers = {
    'Content-Type': 'application/ssml+xml',
    'X-Microsoft-OutputFormat': format,
  };
  if (auth.mode === 'key') headers['Ocp-Apim-Subscription-Key'] = auth.value;
  else headers.Authorization = `Bearer ${auth.value}`;

  const res = await fetch(endpoint, { method: 'POST', headers, body: ssml(text) });
  if (!res.ok) {
    throw new Error(`speech ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(outPath, buf);
  return buf.length;
}

async function main() {
  const manifestPath = path.join(OUT, MANIFEST);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  await mkdir(AUDIO, { recursive: true });

  const auth = await speechAuth();
  let made = 0, kept = 0;

  for (const scene of manifest.scenes) {
    for (const f of FORMATS) {
      const file = `${scene.id}.${f.ext}`;
      const abs = path.join(AUDIO, file);
      const size = await stat(abs).then((st) => st.size).catch(() => 0);
      const key = f.primary ? 'audio' : 'audioAlt';

      if (size > 0 && !FORCE) {
        // Re-capturing rewrites the manifest, so restate these rather than leaving the
        // player without them. This does NOT re-check whether scene.say changed — see the
        // --force gotcha documented at the top of this file and in the skill's
        // pipeline-reference.md.
        scene[key] = `audio/${file}`;
        if (f.primary) scene.seconds = Math.round((size * 8) / (f.kbps * 1000));
        kept++;
        continue;
      }
      const bytes = await synthesise(auth, scene.say, abs, f.spec);
      scene[key] = `audio/${file}`;
      if (f.primary) {
        scene.seconds = Math.round((bytes * 8) / (f.kbps * 1000));
        console.log(`  ${scene.id}  ${Math.round(bytes / 1024)}KB  ~${scene.seconds}s`);
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
