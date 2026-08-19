---
name: demo-production
description: 'Build a narrated, click-through product demo (a full walkthrough, a short lightning cut, and a denser delivery runbook), or refresh/improve an existing one. Use when asked to: build a demo, create a product walkthrough, record a narrated demo video, add a lightning/short cut, add a delivery runbook, produce a click-through demo, add or fix voiceover/narration for a demo, calibrate demo narration quality, fix blurry or low-resolution demo screenshots, verify demo capture resolution, generate an AI demo narrative or demo script before recording anything, set up access or a service principal for demoing a gated Azure resource, or set up a demo capture-narrate-build pipeline for a new project.'
---

# Demo production

A complete, portable methodology and toolkit for producing high-quality narrated product
demos: real screenshots of a running product, a calibrated natural-sounding voiceover, and
three ready-to-use assets per audience — an interactive click-through, an MP4, and a markdown
script a live presenter can read from. This skill has no dependency on any specific product or
platform; the `reference-implementation/` folder next to this file is a working, generic
pipeline you wire up to whatever you're demoing.

Read this file first. The `references/` files are loaded only when you reach the step that
needs them.

## What "high quality" means here, concretely

This isn't a vague aspiration — it decomposes into five specific, checkable things:

1. **Screenshots are captured at real resolution, not whatever an embedded browser happened to
   render.** This is measured, not eyeballed — see [`references/capture-quality.md`](references/capture-quality.md).
2. **The narration sounds like a person, not a document being read aloud.** This is measured,
   not judged by ear — see [`references/narration-style.md`](references/narration-style.md).
3. **Every claim is grounded in something the product actually does**, never an invented
   statistic or an unverifiable percentage.
4. **Each audience gets its own story**, told in the vocabulary and about the value that
   audience actually cares about — see [`references/new-track-guide.md`](references/new-track-guide.md).
5. **Three complementary assets, not one** — a full walkthrough, a short cut, and a runbook for
   a presenter who isn't the demo's author. See the model below.

## Just want the script? Generate an AI demo narrative first

Not every ask is for a full recording. If what's wanted is the **story** — the act structure
and the scene-by-scene narration lines, as a document a human can read and mark up before any
capture or Speech-synthesis budget is spent — that's a **demo narrative**, and it's a
deliverable on its own. See [`references/ai-narrative-generation.md`](references/ai-narrative-generation.md)
for the exact format and how it plugs into the workflow below once it's approved.

## The three-asset model

| Asset | Length | Audience | Purpose |
|---|---|---|---|
| **Full walkthrough** | 15–18 min | Whoever is watching it stand-alone | The complete story, screen by screen, its own capture |
| **Lightning cut** | 10 min (3 min safe cut) | A short calendar slot | The same story, faster pacing, its **own** fresh capture — never sliced from the walkthrough |
| **Delivery runbook** | Matches the walkthrough | A presenter who isn't the author | Denser, names real routes/config/file paths, **reuses** the walkthrough's captured frames |

Each asset is: a scene manifest (fresh capture) or a cut definition (reused frames), a narrated
`.mp4`, an interactive `.html` player, and a markdown script.

## Building a new demo track

1. **Get the reference implementation running first**, before writing a single scene. Copy
   `reference-implementation/` into your project (or point at it directly), follow
   `reference-implementation/CONFIGURE.md` to wire up your product's URL, any auth it needs,
   an Azure AI Speech resource, and ffmpeg. Capture one trivial scene end-to-end to prove the
   pipeline works before investing in real content — and check that scene's screenshot came
   out at the real, calibrated resolution (see
   [`references/capture-quality.md`](references/capture-quality.md)), not a small or blurry
   capture from an embedded browser panel. Catching a resolution problem on one throwaway
   scene is free; catching it after capturing all 17 scenes of a real walkthrough is not.
   If the subject is a real, gated resource (not something with a built-in credential-free demo
   mode), decide **whose credential captures it** before this step touches it — see
   [`references/external-resource-access.md`](references/external-resource-access.md).
2. **Research the audience's real value proposition.** Don't guess. Ground every claim in a
   concrete, verifiable fact about the product — a real enforcement mechanism, a real screen, a
   real workflow — never an invented feature or a plausible-sounding capability that doesn't
   exist. See [`references/new-track-guide.md`](references/new-track-guide.md) for the research
   checklist and the exact three-tier act structure.
3. **Design the acts before writing scenes.** 6–9 acts for a walkthrough, one scene per act
   beat, roughly 15–17 scenes total.
4. **Write the scene manifest(s).** Follow the schema and generic step vocabulary in
   [`references/scene-schema.md`](references/scene-schema.md). The core engine ships only
   generic steps (navigate, wait, scroll, click, type, press) — add anything your product needs
   beyond that as a `CUSTOM_STEPS` entry in your own scenes file, never by editing the engine.
5. **Write the three markdown scripts** (walkthrough, lightning, runbook) following the exact
   structure in [`references/new-track-guide.md`](references/new-track-guide.md).
6. **Do the narration style pass before spending a single Speech call.** This is a measured,
   mechanical check, documented in full in
   [`references/narration-style.md`](references/narration-style.md) — skipping it produces
   narration that sounds noticeably more stilted, and it's cheap to run before you narrate.
7. **Run the production pipeline.** Exact commands and — critically — the gotchas that silently
   produce wrong output, are in
   [`references/pipeline-reference.md`](references/pipeline-reference.md). Read it before your
   first `narrate.mjs` call.
8. **Ship it.** Commit the `.mp4`s and `.html` players alongside the markdown scripts, and index
   them somewhere discoverable in your project's own docs.

## Refreshing or improving an existing track

1. Identify precisely what's missing or wrong — a specific factual gap, a specific tone
   problem, or a measured quality regression. "Make it better" is not actionable.
2. Edit the scene manifest(s) and/or markdown docs directly.
3. **Re-run the narration style audit** in
   [`references/narration-style.md`](references/narration-style.md) on the files you touched —
   even a few added sentences can regress the calibrated ratio.
4. Recapture and re-narrate. Read
   [`references/pipeline-reference.md`](references/pipeline-reference.md) **before** running
   `narrate.mjs` — editing an existing scene's text and simply recapturing is not enough to get
   the new narration into the video; there is a specific flag required, and skipping it produces
   a video that silently plays the *old* narration over new screenshots.
5. Rebuild, re-test, ship.

## The gotchas that will cost you a rebuild if you skip the references

These are a memory jog only — each is covered in full, with the exact fix, in the linked file.

1. **An embedded/IDE browser panel renders at its own small, fixed size no matter what CSS or
   viewport settings you set** — screenshots taken from one are permanently low-resolution.
   Capture always launches its own separate, real browser process instead, and the resolution
   is controlled explicitly, not inherited from whatever window happened to be open. →
   [`capture-quality.md`](references/capture-quality.md)
2. The capture engine, with no `--manifest` flag, wipes the **entire** screenshots folder
   first, including every other manifest's screenshots. →
   [`pipeline-reference.md`](references/pipeline-reference.md)
3. Narration caching is by **file existence**, not by content — an edited scene silently keeps
   its old audio unless you pass `--force`. → [`pipeline-reference.md`](references/pipeline-reference.md)
4. Only the step verbs in [`scene-schema.md`](references/scene-schema.md) exist in the core
   engine; anything product-specific must be added as a `CUSTOM_STEPS` entry in your own scenes
   file, never by forking the engine.
5. Narration quality is measured, not judged by ear — an em-dash becomes a forced pause in the
   synthesised audio, so em-dash density and contraction density per scene are the two concrete
   numbers that separate natural-sounding narration from a stilted read-aloud. →
   [`narration-style.md`](references/narration-style.md)
6. A UI element only reads as present if it's **actually rendered for the exact state** the
   scene captures — many product screens only render once matching data already exists. Verify
   the real on-screen text and conditions in the product's own source before writing a
   `scrollTo`/`spotlight` spec against it. → [`scene-schema.md`](references/scene-schema.md)
7. Demoing a gated resource with no plan for whose credential captures it is how a demo quietly
   turns into standing, unaccounted-for access — decide interactive-vs-SPN and least-privilege
   scope **before** capturing, not after. → [`external-resource-access.md`](references/external-resource-access.md)

## What's in this package

```
demo-production/
├── SKILL.md                          you are here
├── references/
│   ├── capture-quality.md             the calibrated screenshot-resolution bar and how to verify it
│   ├── scene-schema.md               generic step vocabulary + the CUSTOM_STEPS extension point
│   ├── narration-style.md            the measurable natural-speech calibration bar
│   ├── new-track-guide.md            audience research + the three-document markdown template
│   ├── pipeline-reference.md         exact commands + the two silent-failure gotchas
│   ├── ai-narrative-generation.md    generating just the script, before any capture/Speech cost
│   └── external-resource-access.md   deciding whose credential captures a gated resource
└── reference-implementation/          a working, generic, product-agnostic pipeline
    ├── CONFIGURE.md                   what to wire up for YOUR product (read this first)
    ├── capture.mjs                    drives a real browser through your scenes
    ├── narrate.mjs                    Azure AI Speech narration, the calibrated SSML shaping
    ├── build-player.mjs               assembles the interactive HTML click-through
    ├── build-video.mjs                renders the same scenes to an MP4
    ├── build-cut.mjs                  assembles a lightning/runbook cut from already-captured frames
    ├── setup-demo-access.ps1         verify/plan/create a least-privilege Azure SPN for a gated resource
    ├── scenes.example.mjs             copy this to start a new track
    ├── cuts.example.mjs               copy this to start a lightning/runbook cut
    └── lib/cdp.mjs                    a small, dependency-free Chrome DevTools Protocol client
```
