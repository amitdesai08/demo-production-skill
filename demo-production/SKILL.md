---
name: demo-production
description: 'Build a narrated, click-through product demo (a full walkthrough, a short lightning cut, and a denser delivery runbook) for any product, repo or environment, or refresh/improve an existing one. Use when asked to: build a demo, demo my app/repo/project/environment, create a product walkthrough, record a narrated demo video, record the product being used rather than screenshotted, film an app hosted inside Teams or a portal, add a lightning/short cut, add a delivery runbook, produce a click-through demo, add or fix voiceover/narration for a demo, calibrate demo narration quality, add captions/subtitles or a transcript to a demo, make a demo accessible, add on-screen highlights or chapter titles to a demo, fix blurry or low-resolution demo screenshots, verify demo capture resolution, generate an AI demo narrative or demo script before recording anything, set up access or a service principal for demoing a gated Azure resource, or set up a demo capture-narrate-build pipeline for a new project.'
---

# Demo production

A complete, portable methodology and toolkit for producing high-quality narrated product
demos: real screenshots of a running product, a calibrated natural-sounding voiceover, on-screen
emphasis timed to the voice, and ready-to-use assets per audience — an interactive
click-through, an MP4 with its caption/transcript/audio set, and a markdown script a live
presenter can read from. This skill has no dependency on any specific product or platform; the
`reference-implementation/` folder next to this file is a working, generic pipeline you wire up
to whatever you're demoing.

Read this file first. The `references/` files are loaded only when you reach the step that
needs them.

## What "high quality" means here, concretely

This isn't a vague aspiration — it decomposes into specific, checkable things:

1. **Screenshots are captured at real resolution, not whatever an embedded browser happened to
   render.** This is measured, not eyeballed — see [`references/capture-quality.md`](references/capture-quality.md).
2. **The narration sounds like a person, not a document being read aloud.** This is measured,
   not judged by ear — see [`references/narration-style.md`](references/narration-style.md).
3. **Every claim is grounded in something the product actually does**, never an invented
   statistic or an unverifiable percentage.
4. **Each audience gets its own story**, told in the vocabulary and about the value that
   audience actually cares about — see [`references/new-track-guide.md`](references/new-track-guide.md).
5. **The viewer is shown where to look, and sees somebody looking there** — highlights timed
   to the sentence that explains them, and a pointer that travels to each one and arrives as
   it appears — see [`references/on-screen-emphasis.md`](references/on-screen-emphasis.md).
6. **It ships watchable without sound and usable without sight** — captions cut from the real
   voice timings, a transcript, and an audio-only track, all built from the same source as the
   video — see [`references/accessible-outputs.md`](references/accessible-outputs.md).
7. **Optionally, the product is recorded rather than screenshotted**, so the demo shows the
   app responding instead of a slideshow of its screens — see
   [`references/live-capture.md`](references/live-capture.md).
8. **Three complementary assets, not one** — a full walkthrough, a short cut, and a runbook for
   a presenter who isn't the demo's author. See the model below.

## Just want the script? Generate an AI demo narrative first

Not every ask is for a full recording. If what's wanted is the **story** — the act structure
and the scene-by-scene narration lines, as a document a human can read and mark up before any
capture or Speech-synthesis budget is spent — that's a **demo narrative**, and it's a
deliverable on its own. See [`references/ai-narrative-generation.md`](references/ai-narrative-generation.md)
for the exact format and how it plugs into the workflow below once it's approved.

## Start here: what are you demoing?

The subject is whatever the user points at — **a repo, a running URL, or a cloud resource** —
and the first job is turning that into something capturable: get it running, work out whether
it needs auth at all, and confirm what is safe to put on screen. Read
[`references/demo-intake.md`](references/demo-intake.md) before step 1.

Two rules worth stating up front, because both are easy to get wrong in the first five minutes:

- **Discover before you ask.** How the product runs, what screens it has, and whether it has
  seeded demo data are all readable from the repo. Ask only what you genuinely cannot determine.
- **Prompt for credentials only if needed, and never for a secret in chat.** A locally-run app
  with seeded data usually needs nothing. When a real sign-in is unavoidable, use a persistent
  browser profile the user signs into by hand, once.

## The three-asset model

| Asset | Length | Audience | Purpose |
|---|---|---|---|
| **Full walkthrough** | 15–18 min | Whoever is watching it stand-alone | The complete story, screen by screen, its own capture |
| **Lightning cut** | 10 min (3 min safe cut) | A short calendar slot | The same story, faster pacing, its **own** fresh capture — never sliced from the walkthrough |
| **Delivery runbook** | Matches the walkthrough | A presenter who isn't the author | Denser, names real routes/config/file paths, **reuses** the walkthrough's captured frames |

Each asset is: a scene manifest (fresh capture) or a cut definition (reused frames), a narrated
`.mp4`, an interactive `.html` player, a markdown script, and the accompanying `.vtt`/`.srt`/
`.ttml`, `.txt` and `.mp3` for that cut.

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
   Declare what each scene highlights while you are here; anchoring those highlights to the
   narration is a later step ([`references/on-screen-emphasis.md`](references/on-screen-emphasis.md)).
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
8. **Anchor the highlights to the narration**, once there is recorded audio to anchor them to.
   See [`references/on-screen-emphasis.md`](references/on-screen-emphasis.md).
9. **Build the accessible set for every cut you ship** — captions, transcript, audio-only
   track. See [`references/accessible-outputs.md`](references/accessible-outputs.md).
10. **Ship it.** Commit the `.mp4`s, their caption/transcript/audio files and the `.html`
   players alongside the markdown scripts, and index them somewhere discoverable in your
   project's own docs.

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
5. Narration quality is measured, not judged by ear — an em-dash or a colon becomes a forced
   pause in the synthesised audio, so their density and contraction density per scene are the
   concrete numbers that separate natural narration from a stilted read-aloud. **Pauses must
   be graded, not uniform**: a uniform break at every sentence reads as stilted and no break
   at all reads as run-on. → [`narration-style.md`](references/narration-style.md)
6. A UI element only reads as present if it's **actually rendered for the exact state** the
   scene captures — many product screens only render once matching data already exists. Verify
   the real on-screen text and conditions in the product's own source before writing a
   `scrollTo`/`spotlight` spec against it. → [`scene-schema.md`](references/scene-schema.md)
7. Demoing a gated resource with no plan for whose credential captures it is how a demo quietly
   turns into standing, unaccounted-for access — decide interactive-vs-SPN and least-privilege
   scope **before** capturing, not after. → [`external-resource-access.md`](references/external-resource-access.md)
8. A scroll step can succeed and scroll nothing, because the page is often not what scrolls —
   name your app's scroll panes in `SCROLL_CONTAINERS`. → [`scene-schema.md`](references/scene-schema.md)
9. Rewording a line silently un-anchors any highlight cued to it, and the build says so with a
   line starting `!` that nothing else will flag. **Scan the build output for `!`.** →
   [`on-screen-emphasis.md`](references/on-screen-emphasis.md)
10. Every failure mode in ffmpeg's expression evaluator here is silent, and `drawbox` cannot
   animate on time at all (`t` there means `thickness`). Anything that moves is an `overlay`
   of a pre-rendered PNG. Verify overlay changes by rendering and reading pixels back, not by
   looking at one frame. →
   [`on-screen-emphasis.md`](references/on-screen-emphasis.md)
11. Captions, transcript and audio track must never compute their own timeline — they share
   `lib/timing.mjs` and `lib/track-timeline.mjs` with the video, or they drift a little further
   out of step with every scene. → [`accessible-outputs.md`](references/accessible-outputs.md)
12. **ffmpeg's concat demuxer will not hold your last frame.** It ignores the final entry's
    duration outright, drops a long final hold even when you repeat the frame, and `-r 30`
    inflates the result. Clone the last frame with `tpad`, set the length with `-t`, and have
    the encoder probe its own output. → [`live-capture.md`](references/live-capture.md)
13. **A low frame count is not a bug** — a screencast only emits on change, so a calm scene is
    genuinely three frames. Check a clip's duration against its narration, never its frame
    count. → [`live-capture.md`](references/live-capture.md)
14. **Cue times are relative to the clip, not to whenever the choreography happens to start.**
    Any scene whose setup runs on camera will otherwise fire every highlight late by exactly
    the setup duration, and overdue cues will all fire at once. →
    [`on-screen-emphasis.md`](references/on-screen-emphasis.md)
15. **Cue-to-region binding is positional.** Never compact the region list to drop an
    unresolvable one: it renumbers everything after it and silently re-aims later cues at the
    wrong things. → [`on-screen-emphasis.md`](references/on-screen-emphasis.md)
16. **Host chrome must be dismissed before the app's position is measured**, and re-measured
    per scene. A banner that closes after you measure leaves every pointer and highlight out by
    its height — invisible in a spot check, and it will pass review. →
    [`hosted-app-capture.md`](references/hosted-app-capture.md)
17. **A long-lived host tab keeps the last run's state.** Set the opening identity, role or
    filter explicitly; assuming it runs a whole act under the wrong one and still reports `ok`.
    → [`hosted-app-capture.md`](references/hosted-app-capture.md)
18. **A screenshot-only pass does not run the scene's interactions**, so a selector verified
    there may not exist when the real capture measures it. Ground selectors in the state the
    capture is actually in. → [`on-screen-emphasis.md`](references/on-screen-emphasis.md)

## When something is wrong, measure it — do not reason about it

Nearly every expensive mistake in building this came from deducing where time or pixels had
gone instead of instrumenting it. Several bugs each took multiple wrong fixes because the
reasoning was plausible and wrong; each was then settled in minutes by a measurement.

Practices that earned their place:

- **Make components check themselves.** The encoder comparing its output to the timeline it was
  handed found in one line what three rounds of analysis had missed.
- **Reproduce in isolation, with the *real* shape.** A first isolated test of the encoder used
  three convenient frames, passed, and sent the investigation down the wrong path for another
  round. The real clips had bursts of very short durations plus one long hold, and reproduced
  the failure immediately.
- **Report, never silently skip.** An unresolvable selector, a cue phrase that no longer
  matches, a clip that disagrees with its timeline — each should print. Silent degradation in a
  demo pipeline surfaces as "it feels off" weeks later.
- **Two runs disagreeing about geometry is a bug, not noise.** Reconcile it before building.
- **Confirm on a frame.** Numbers confirm the timeline; only an extracted frame confirms the
  box is around the right thing and the cursor is on it.

## What's in this package

```
demo-production/
├── SKILL.md                          you are here
├── references/
│   ├── demo-intake.md                turning a repo/URL/resource into a capturable subject
│   ├── capture-quality.md             the calibrated screenshot-resolution bar and how to verify it
│   ├── live-capture.md               recording the product being driven, instead of screenshotting it
│   ├── hosted-app-capture.md         filming the product inside a host app, portal or iframe
│   ├── scene-schema.md               generic step vocabulary + the CUSTOM_STEPS extension point
│   ├── narration-style.md            the measurable natural-speech calibration bar
│   ├── on-screen-emphasis.md         chapter titles + highlights cued to the spoken words
│   ├── accessible-outputs.md         captions from real voice timings, transcript, audio-only track
│   ├── new-track-guide.md            audience research + the three-document markdown template
│   ├── pipeline-reference.md         exact commands + the silent-failure gotchas
│   ├── ai-narrative-generation.md    generating just the script, before any capture/Speech cost
│   └── external-resource-access.md   deciding whose credential captures a gated resource
└── reference-implementation/          a working, generic, product-agnostic pipeline
    ├── CONFIGURE.md                   what to wire up for YOUR product (read this first)
    ├── capture.mjs                    drives a real browser through your scenes (--video to record it)
    ├── narrate.mjs                    Azure AI Speech narration + per-word timings
    ├── build-player.mjs               assembles the interactive HTML click-through
    ├── build-video.mjs                renders the scenes to an MP4, with titles, highlights and a cursor
    ├── build-cursor.mjs               draws the virtual pointer (SVG via the capture browser)
    ├── build-title-cards.mjs          renders the fly-in title card for each scene
    ├── build-captions.mjs             .vtt/.srt/.ttml cut from the real word timings
    ├── build-transcript.mjs           the plain-text transcript
    ├── build-audio-track.mjs          the audio-only rendition
    ├── build-cut.mjs                  assembles a lightning/runbook cut from already-captured frames
    ├── setup-demo-access.ps1         verify/plan/create a least-privilege Azure SPN for a gated resource
    ├── scenes.example.mjs             copy this to start a new track
    ├── cuts.example.mjs               copy this to start a lightning/runbook cut
    └── lib/
        ├── cdp.mjs                    a small, dependency-free Chrome DevTools Protocol client
        ├── timing.mjs                 the two beats every output shares
        ├── track-timeline.mjs         where each scene starts and ends, for all four builders
        ├── caption-chunks.mjs         splits narration into two-line cues on real timings
        ├── spotlight-cues.mjs         maps a scene's highlights to the phrases that explain them
        ├── pronunciation.mjs          IPA overrides for words the voice gets wrong
        └── ffmpeg.mjs                 locating ffmpeg/ffprobe and measuring files
```
