# Recording the product instead of screenshotting it

`node capture.mjs --video` records each scene as the product is actually driven, and
`build-video.mjs` uses the resulting clip in place of the still. Everything else — narration,
captions, highlights, the pointer, the title card — is unchanged.

Use it when a demo needs to look like somebody using the product rather than a slideshow of
its screens. It is not a different pipeline; it swaps one input.

## What it does and does not give you

**Does:** the app's own behaviour, recorded. Panels opening, content loading, rows lighting up
under the pointer, a page transition — whatever the product genuinely does while the scene's
steps run and while the pointer settles on the region being discussed.

**Does not:** a mouse cursor. CDP screencast does not capture the OS pointer, so the pointer
is still drawn by the video build (see [`on-screen-emphasis.md`](on-screen-emphasis.md)). This
turns out to be an advantage: the drawn pointer is timed to the narration, so it arrives on
the beat, which a recorded pointer would not.

**And be realistic about how much motion there is.** Screencast frames are emitted only when
the page *changes*. On a reference track of a dense enterprise app, scenes ranged from 1 frame
to 96 — the busy ones were a screen loading and a permission dialog resolving; the quiet ones
were static screens where the clip is, correctly, indistinguishable from the screenshot it
replaced. Recording does not manufacture motion that the product does not have.

## Aiming the recording at what the video highlights

By default the recorded hover goes to the middle of whatever the scene's `spotlight` selector
resolved to. If your video highlights something more specific than that selector's element,
the two disagree on screen: the pointer hovers one thing while the box frames another.

Pass `--aim <file>` with a map of scene id to the rectangles the video will actually draw:

```json
{ "aims": { "03-briefing": [{ "x": 256, "y": 120, "w": 849, "h": 806 }] } }
```

The capture then hovers exactly there. Generate this from whatever your project treats as the
source of truth for highlight rectangles, so the two cannot drift apart.

This also tends to *improve* the recording: aiming at a real interactive element makes the app
respond, so there is more to capture. On the reference track, re-aiming took one scene from 2
frames to 96.

## Hover, not click

The final pointer move dispatches `mouseMoved` only. No press is sent.

This is deliberate and was learned the hard way. The scene's own steps already perform the
real clicks, and those are recorded. An *extra* click at the end lands on whatever the
highlight frames — and if that is a nav item or a link, the app navigates away, so every
following scene records the wrong screen. The click the viewer sees is drawn.

## Timing

A clip is short (a few seconds) and a scene is as long as its narration. The video build slides
the clip so its tail — where the captured hover sits — lands as the narration reaches the
point, then holds the last frame for the remainder. So the interaction happens on the beat
rather than wherever the capture happened to fall.

## Practicalities

- **ffmpeg is required by `capture.mjs`** in this mode, which it otherwise does not need.
- **Run the whole scene list, not a subset.** Scenes share browser state, and a partial run
  skips the navigation later scenes depend on.
- **A screenshot timeout no longer loses the clip.** Capturing a full-resolution screenshot
  while screencasting can time out; the scene is still recorded, and the run reports
  `[no screenshot]` rather than failing.
- Clips land in `build/clips/<scene-id>.mp4` and the manifest gains `video` per scene. Delete
  the clip and the scene silently falls back to its screenshot, so the two can be mixed.
