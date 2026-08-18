# Production pipeline — exact commands and gotchas

These commands assume you've copied `reference-implementation/` into your project (or are
running it from wherever you placed it) and followed `reference-implementation/CONFIGURE.md`.

## Prerequisites

- **The product you're demoing is reachable**, and you know its base URL. Note the capture
  date too — any figure narrated out loud (a count, a label) needs to be current as of capture.
- **Node 22 or later** — the capture engine's Chrome DevTools Protocol client uses the global
  `WebSocket` built into Node, which isn't reliably available before that version.
- **Azure AI Speech access** — either a subscription key, or an active `az login` session with
  the Cognitive Services Speech User role on the target resource. See `CONFIGURE.md`.
- **ffmpeg + ffprobe on `PATH`** (or `DEMO_FFMPEG`/`DEMO_FFPROBE` pointing at a portable build)
  — only `build-video.mjs` needs this; nothing else in the pipeline does.
- **Whatever auth your product itself needs** for the capture browser session — see the
  `DEMO_AUTH_HEADER` mechanism in `CONFIGURE.md`.
- **A real, separately-launched browser for capture — never an IDE's embedded/simple browser.**
  This is what the pipeline already does by design (see
  [`capture-quality.md`](capture-quality.md)); the prerequisite is just don't try to point
  `DEMO_BROWSER` at anything other than a real Edge/Chrome executable.

## The full command set, per manifest

For a **fresh-capture manifest** (a walkthrough or a lightning cut — anything with its own
`scenes-<name>.mjs` file):

```powershell
node capture.mjs      --scenes scenes-<name>.mjs --manifest scenes-<name>.json
node narrate.mjs      --manifest scenes-<name>.json [--force]   # see gotcha #2 below
node build-player.mjs --manifest scenes-<name>.json --out <name>.html
node build-video.mjs  --manifest scenes-<name>.json --out <name>.mp4
```

For a **runbook/short cut** (reuses already-captured frames via `cuts.mjs`, no browser
automation needed):

```powershell
node build-cut.mjs <cut-name>
node narrate.mjs      --manifest scenes-<cut-name>.json [--force]
node build-player.mjs --manifest scenes-<cut-name>.json --out <cut-name>.html
node build-video.mjs  --manifest scenes-<cut-name>.json --out <cut-name>.mp4
```

`build-cut.mjs` always writes `build/scenes-<cut-name>.json` — use that exact name for the
following steps.

## Gotcha #1 — the bare `capture.mjs` invocation wipes the screenshots folder

Running `node capture.mjs` with **no `--manifest` flag** (i.e. targeting the default
`scenes.json`) clears the entire `build/shots/` folder first. If you've already captured other
decks in this session under different manifest names, this is harmless to *them* (only the
default manifest's own recapture wipes shots — see the comment in `capture.mjs`'s `main()`), but
running the bare default form again after making other captures with named manifests can still
be surprising the first time you see it. The safe habit either way: **always pass an explicit
`--manifest`** once you have more than one deck in flight in the same project.

## Gotcha #2 — `narrate.mjs` caches by file existence, not by content

This is the single most expensive mistake to make, because it fails silently and produces a
perfectly normal-looking successful build.

`narrate.mjs` decides whether to (re-)synthesise a scene's audio purely by checking whether
`audio/<scene-id>.mp3` already exists on disk with a nonzero size — it does **not** hash or
compare the narration text:

```js
// from narrate.mjs
const size = await stat(abs).then((st) => st.size).catch(() => 0);
if (size > 0 && !FORCE) {
  // ...reuses the existing file, does NOT check whether scene.say changed
  continue;
}
```

So the sequence "edit a scene's `say` text for an existing scene id → recapture → run
`narrate.mjs`" will **not** pick up the new text if that scene id already has audio from a
previous run — it silently keeps the old audio, and `build-video.mjs` will happily assemble a
video with screenshots that don't match what's being said. The build succeeds; the output is
wrong.

**Rule:** whenever you edit `say` text for a scene id that's been narrated before in this
manifest, run `narrate.mjs` with `--force`:

```powershell
node narrate.mjs --manifest scenes-<name>.json --force
```

`--force` re-synthesises everything in the manifest — this costs more Speech calls and takes
longer, but is the only way to guarantee the audio matches the current text. Brand-new scene
ids are unaffected either way (no existing file to reuse), so this only matters when
**editing** an existing track, not writing one from scratch.

## Gotcha #3 — `narrate.mjs` reads from the captured JSON, not the source `.mjs`

Related: narration text is synthesised from `scene.say` as it exists in the **captured**
manifest (`build/scenes-<name>.json`), written by `capture.mjs` — not read fresh from your
source `scenes-<name>.mjs` at narrate time. If you edit a scene's text in the source file, you
must **recapture first** (which rewrites the captured JSON with the new text), *then* run
`narrate.mjs --force`.

## Order of operations, summarised

For an edit to an **existing** scene's text: edit the `.mjs` source → `capture.mjs --manifest
X.json` (recapture) → `narrate.mjs --manifest X.json --force` → `build-player.mjs` →
`build-video.mjs`.

For a **brand-new** scene appended to an existing manifest: same order, `--force` is optional
(the new scene gets synthesised regardless), but costs nothing extra to add if you're already
forcing a rebuild for other edited scenes in the same file.

## After the build: shipping it

1. Copy the rebuilt `.mp4`s from `build/` into wherever your project keeps its recordings.
   `build/` itself should be gitignored; the shipped `.mp4`s and `.html` players are small
   enough (a few MB each) to commit directly alongside the docs that reference them.
2. Update your project's own recordings index with the new/changed length, size and scene
   counts.
3. Run whatever test suite your product has, as a cheap confirmation nothing else was
   disturbed — demo work should touch no application code.
4. Commit and push.
