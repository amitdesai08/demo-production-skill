# On-screen emphasis — chapter titles, cued highlights, and a virtual cursor

A screenshot of a dense product screen is not self-explanatory. While the narration makes a
point about one panel, the viewer is looking at forty other things. And a sequence of still
screenshots, however well annotated, reads as a diagram rather than as somebody using the
product. Three overlays fix both problems without touching the product: a chapter title
naming the section, a highlight around the region being discussed **at the moment it is
discussed**, and a pointer that travels to that region and arrives as the highlight appears.

All three are rendered by `build-video.mjs` from data the pipeline already has, so none needs
a video editor and none goes stale independently of the narration.

## A pointer that behaves like a person

`build-cursor.mjs` draws the pointer once, as an SVG in the same headless browser the capture
step uses, screenshotted over a transparent background. `build-video.mjs` then flies it to
each highlighted region so that it **arrives exactly as that region's highlight appears** —
which reads as the click landing. It also carries over from where the previous scene left it,
rather than teleporting to a fresh start position at every cut, so the whole piece feels like
one continuous session.

Its path is a sum of `clip()` ramps, one per target, which telescopes exactly to the final
position; it is not built from branching, because a nested `if()` is mis-evaluated here.

Set `DEMO_VIDEO_CURSOR=0` to render without it. A scene with no highlights gets no pointer,
so an opening or summary scene stays still.

**What this is not.** The screenshots are stills, so the interface does not visibly respond
to the click within the scene — the *next* scene shows the result. That reads as cause and
effect and is a long-standing click-through convention, but it is not the same thing as a
screen recording, where content streams in and panels open live. If a demo genuinely needs
that, it needs video capture, not this pipeline.

## Titles that fly in

`build-title-cards.mjs` renders one card per scene — rounded corners, a gradient accent bar,
an act eyebrow, a drop shadow, real typography — in the browser, then `build-video.mjs` flies
the whole card in from off the left edge with a cubic ease-out, holds it long enough to read,
and eases it back out. It rests in the lower third so it never covers the part of the product
being described.

The card is one pre-rendered PNG on purpose. A title assembled from ffmpeg primitives cannot
animate: see the limits below.

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

Established by rendering each case in isolation and reading the pixels back, because **every
failure mode in ffmpeg's expression evaluator here is silent** — the filter draws nothing, or
draws in the wrong place, and ffmpeg still reports success at `-loglevel warning`. If you
extend these overlays, verify the same way rather than by inspecting a single frame, which
cannot tell you whether something moved.

1. **`drawbox` cannot animate on time.** Inside a `drawbox` x/y/w/h expression, `t` is that
   filter's own `thickness` option, which shadows the timestamp variable. A box whose `x` is
   `10+300*clip(t/3,0,1)` does not move: measured at 0.1s and 2.9s it sat at the same pixel
   both times. Change a box's **visibility** with `enable=`, where `t` genuinely is the
   timestamp, and leave its geometry constant. The highlight frames work exactly this way.
2. **`drawtext` can**, and **`overlay` can.** The identical expression moved a glyph from
   x=24 to x=303 between those two frames. `overlay` additionally honours a delayed start
   (`t` minus a constant) *and* an `enable=` window on the same filter — measured hidden at
   0.2s, parked at x=10 at 0.8s, mid-travel at x=154 at 1.5s, arrived at x=310 at 2.5s.

So **anything that moves is an `overlay` of a pre-rendered PNG**. That is not just a
workaround: it also means the artwork is designed in a browser, with gradients, shadows and
real type, instead of being assembled from rectangles.

The trap to avoid is mixing the two. An earlier version of this pipeline drew a title as a
`drawbox` plate with a `drawtext` label and animated both with the same expression. The label
moved and the plate did not, so for the first fraction of a second the text slid across and
outside its own background — which is exactly what "janky" looks like.

Also avoid nesting an `if()` as another `if()`'s false branch; that is mis-evaluated. Prefer
`clip(x, 0, 1)` arithmetic.

## Frame rate matters for motion

These segments are one still image per scene, so the frame rate is otherwise almost free to
choose. It stopped being free once things moved: at 10fps a half-second glide is five frames
and stutters. The default is now **30fps** (`DEMO_VIDEO_FPS`), which costs little because only
the overlays change between frames — on the reference track the video grew from 4.6MB to
6.0MB.

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
| `DEMO_VIDEO_TITLES` | on | Set `0` to render without chapter title cards |
| `DEMO_VIDEO_TITLE_SECONDS` | `2.9` | How long a title card holds, between its fly-in and fly-out |
| `DEMO_VIDEO_CURSOR` | on | Set `0` to render without the virtual pointer |
| `DEMO_VIDEO_FPS` | `30` | Lower only if nothing moves |
| `DEMO_VIDEO_ACCENT` | `0x4F6BED` | Colour of the highlight and the title card's accent bar |
