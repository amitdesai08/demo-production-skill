# Configuring the reference implementation for your product

Everything in this folder is generic except the five things below — check each one before your
first capture. Nothing here reads or depends on any specific product; you are the one wiring it
to yours.

## 1. `scenes.mjs` — copy `scenes.example.mjs` and fill in

- `BASE` — your product's URL (or an env var, `DEMO_BASE_URL`, so it isn't hardcoded).
- `TITLE` / `SUBTITLE` / `DISCLAIMER` — what the interactive player's opening card says.
- `ACTS` and `SCENES` — your actual demo, following the schema in the skill's
  `references/scene-schema.md`.
- `CUSTOM_STEPS` (optional) — anything your product needs beyond the generic step vocabulary
  (`goto`, `wait`, `waitText`, `scrollTop`, `scrollTo`, `clickText`, `click`, `type`, `press`,
  `dismiss`). A role/persona switcher is the most common addition — see the example.
- `TEASER_SCENES` (optional) — which scene ids make a good short teaser cut.

## 2. Authentication into your product, if it needs any

`capture.mjs` supports one generic mechanism: set `DEMO_AUTH_HEADER` to `"Header-Name: value"`
and it is attached to every request the captured browser session makes. That covers a static
bearer token, an API key header, or a service-account credential your infrastructure already
knows how to mint. If your product's auth is more involved (an OAuth device-code flow, a
short-lived signed URL), write that logic as a small helper your `scenes.mjs` calls before
`capture.mjs` starts, and have it set `DEMO_AUTH_HEADER` in the environment for you.

If the subject is an Azure resource behind real RBAC (a Foundry deployment, an ADF pipeline, an
AI Search index) rather than your own app, don't wire up ad hoc credentials — work through the
skill's `references/external-resource-access.md` first to decide whose credential captures it,
then use `setup-demo-access.ps1` in this folder to verify access or provision a least-privilege
service principal.

## 3. Azure AI Speech — the voice

`narrate.mjs` needs one of:
- `SPEECH_KEY` + `SPEECH_REGION` — a standard Azure AI Speech resource key. This is the default
  path and works for almost everyone.
- `SPEECH_RESOURCE` + `SPEECH_RESOURCE_GROUP` + `SPEECH_REGION`, with `SPEECH_KEY` left unset —
  for a Speech resource with local/key auth disabled (Entra-only), authenticating via an
  already-active `az login` session and the **Cognitive Services Speech User** role.

Optional tuning, all with sensible defaults: `DEMO_VOICE` (a specific neural voice),
`DEMO_RATE` (speaking rate), `DEMO_STYLE` (a speaking style your chosen voice supports).

## 4. ffmpeg, for the MP4 build

`build-video.mjs` needs `ffmpeg` and `ffprobe` on `PATH`, or `DEMO_FFMPEG` / `DEMO_FFPROBE`
pointing at a portable build. Nothing else in this folder needs it — `capture.mjs`,
`narrate.mjs` and `build-player.mjs` have no native dependency at all.

## 5. Screenshot resolution — verify it, don't just trust the defaults

The defaults (`DEMO_WIDTH=1440`, `DEMO_HEIGHT=900`, `DEMO_SCALE=2`, producing a 2880×1800
physical-pixel capture) are calibrated to look sharp in the interactive player, the rendered
MP4, and projected in a live room — you shouldn't need to change them. But **the first time you
run a capture in a new environment, check the actual output dimensions of one screenshot**
rather than assuming they came out right — see
[`../skill/references/capture-quality.md`](../skill/references/capture-quality.md) for exactly
why this matters (the short version: an embedded/IDE browser panel silently caps resolution no
matter what you set, and this pipeline exists specifically to avoid ever capturing from one)
and the one-line PowerShell command to verify it.

## Node version

Requires **Node 22 or later** — `lib/cdp.mjs` uses the global `WebSocket` built into Node,
which isn't reliably available before that version.

## What you should never need to touch

`capture.mjs`'s generic step vocabulary, `lib/cdp.mjs`, `narrate.mjs`'s SSML shaping,
`build-player.mjs`'s player chrome, and `build-video.mjs`'s ffmpeg pipeline are all
product-agnostic already. If you find yourself editing one of them to make your demo work,
stop and add a `CUSTOM_STEPS` entry in your own `scenes.mjs` instead — see
`scenes.example.mjs`.
