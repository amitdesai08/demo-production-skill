# On-screen emphasis — chapter titles and cued highlights

A screenshot of a dense product screen is not self-explanatory. While the narration makes a
point about one panel, the viewer is looking at forty other things. Two overlays fix that
without touching the product: a chapter title naming the section, and a highlight around the
region being discussed **at the moment it is discussed**.

Both are rendered by `build-video.mjs` from data the pipeline already has, so neither needs a
video editor and neither goes stale independently of the narration.

## Highlights that follow the voice

A highlight that appears when the scene opens and sits there for forty seconds emphasises
nothing. The point is to draw the eye as the sentence lands.

`lib/spotlight-cues.mjs` maps a scene id to one spoken phrase per highlight region:

```js
export const SPOTLIGHT_CUES = {
  '03-briefing': ['a daily briefing nobody compiled by hand', 'a small badge marks'],
  '07-access':   ["still isn't allowed into a confidential record"],
};
```

At render time the phrase is located in that scene's real word timings (captured during
synthesis — see [`accessible-outputs.md`](accessible-outputs.md)) and the highlight is timed
to come up just before the phrase and stay through the explanation of it. Because it resolves
against the recording rather than a hand-typed timestamp, **re-recording the narration
re-times the highlights automatically**.

Matching ignores case and punctuation, so a phrase has to follow the narration's wording but
not its punctuation.

### When an edit breaks a cue

Reword the line and the phrase stops matching. The build says so, loudly, naming the scene:

```
  ! 03-briefing: cue "a daily briefing nobody compiled by hand" is no longer spoken in this
    scene — re-anchor it in lib/spotlight-cues.mjs
```

This cannot be fixed automatically — only a person can decide which words in the new sentence
the highlight belongs to. **Scan the build output for `!` after any narration edit.** Nothing
else fails; the highlight silently reverts to appearing at the top of the scene.

A scene with no cue configured still gets its highlight, spread evenly across the scene if
there is more than one region. A summary or closing scene with nothing to point at should
simply declare no `spotlight` at all.

## What the video renderer can and cannot animate

Both of the following were established by rendering the case in isolation and reading the
pixels back, because **every failure mode in ffmpeg's expression evaluator here is silent** —
the filter draws nothing, or draws in the wrong place, and ffmpeg still reports success at
`-loglevel warning`. If you extend these overlays, verify the same way rather than by
inspecting a single frame, which cannot tell you whether something moved.

1. **`drawbox` cannot animate on time.** Inside a `drawbox` x/y/w/h expression, `t` is that
   filter's own `thickness` option, which shadows the timestamp variable. A box whose `x` is
   `10+300*clip(t/3,0,1)` does not move: measured at 0.1s and 2.9s it sat at the same pixel
   both times. Change a box's **visibility** with `enable=`, where `t` genuinely is the
   timestamp, and leave its geometry constant.
2. **`drawtext` can.** The identical expression moved a glyph from x=24 to x=303 between those
   two frames.

The practical consequence is that the chapter title **appears and clears** rather than sliding:
a plate and its label have to move together, and the plate is a `drawbox`, which cannot move at
all. An animated label over a static plate is worse than no animation — the text slides out of
its own background, which is exactly what "janky" looks like.

There is a second reason not to reach for motion here. These segments are a still image per
scene, rendered at **10 fps** (a long GOP on an unchanging frame is what keeps the file small).
Any movement short enough to feel quick is only three or four frames, so it stutters rather
than glides. A title that is simply present when the scene starts reads as deliberate; a
four-frame slide reads as a glitch.

Also avoid nesting an `if()` as another `if()`'s false branch; that is mis-evaluated. Prefer
`clip(x, 0, 1)` arithmetic.

## Coordinates

Highlight rectangles are measured in the browser, in CSS pixels at the capture viewport, and
the screenshots are then scaled to the output width. `build-video.mjs` scales the rectangles by
the same factor (from the manifest's recorded `viewport`) before drawing, and clamps them into
the frame — a box drawn partly outside the frame is dropped entirely rather than clipped.

Two things follow:

- **Re-capture after any layout change.** A rectangle captured against an older layout points
  at whatever now occupies those coordinates.
- **Measured live in a browser is not the same as measured during capture.** The rect is
  computed *after* that scene's scroll and click steps have run, which is usually not what the
  page looks like when you open it by hand.

## Configuration

| Variable | Default | Effect |
|---|---|---|
| `DEMO_VIDEO_TITLES` | on | Set `0` to render without chapter titles |
| `DEMO_VIDEO_TITLE_SECONDS` | `3.4` | How long a chapter title stays up |
| `DEMO_VIDEO_ACCENT` | `0x4F6BED` | Colour of the highlight and the title's accent bar |
| `DEMO_VIDEO_FONT` | Segoe UI Light | Any TTF on the machine |
