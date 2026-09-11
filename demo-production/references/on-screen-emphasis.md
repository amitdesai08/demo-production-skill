# On-screen emphasis — chapter titles, cued highlights, and a virtual cursor

## Contents
- The rule everything else follows
- Rest is the default state
- One script drives both
- Positional alignment — cue *i* binds to region *i*
- Cue timing: three traps
- Highlights move; they do not multiply
- A pointer that behaves like a person
- Titles that fly in
- Highlights that follow the voice
- What the video renderer can and cannot animate
- Frame rate for motion
- Coordinates
- Configuration

A screenshot of a dense product screen is not self-explanatory. While the narration makes a
point about one panel, the viewer is looking at forty other things. And a sequence of still
screenshots, however well annotated, reads as a diagram rather than as somebody using the
product. Three overlays fix both problems without touching the product: a chapter title
naming the section, a highlight around the region being discussed **at the moment it is
discussed**, and a pointer that travels to that region and arrives as the highlight appears.

All three are rendered by `build-video.mjs` from data the pipeline already has, so none needs
a video editor and none goes stale independently of the narration.

## The rule everything else follows

**A highlight and a pointer are different instruments, and conflating them is what makes a
demo feel synthetic.**

- The **highlight** is the narrator's emphasis. It can frame anything worth looking at — a
  panel, a paragraph, a badge, a row.
- The **pointer** is somebody's hand. It goes where a hand would go: a control being used, an
  item singled out from identical siblings, something you would open. Nothing else.

A person does not drag their mouse to the middle of a paragraph they are reading aloud. Move
the cursor to every highlight and the demo still reads as mechanical, even when each move is
individually justifiable.

**The win condition is mimicking human interaction. It is not a number of gestures.** Counting
them is how you end up back at a busy cursor with better excuses. A five-minute demo with four
deliberate pointer moves and a dozen highlight-only moments is richer than one with twenty
moves, because each of the four means something.

## Rest is the default state

A scene with nothing to point at rests. That is not a gap to be filled.

Three mechanisms are worth naming because they are individually reasonable and collectively
disastrous — each solves a real problem, and together they produce exactly the "cursor
wandering for no reason" complaint:

1. **A page tour** for scenes with no cue — hunting the DOM for anything that would repaint and
   hovering it in sequence, usually invented to stop the screencast going quiet.
2. **Idle drift** — nudging the pointer a few pixels every second so it "looks alive".
3. **A settle-back glide** — using up leftover scene time by returning to the last region.

Delete all three. Frames going quiet is correct (see [`live-capture.md`](live-capture.md)); it
is not a problem to be worked around. Give a cue-less scene one park position — low and to one
side, out of the reading area — and have it move there once and stay, guarded by a distance
check so consecutive resting scenes do not re-park.

## One script drives both

The pointer and the highlight must come from a single source, or they will disagree on screen:

```
cue phrases (a phrase per region, per scene)
   → resolved against the REAL per-word timestamps from speech synthesis
plan file: { cues: { scene: [seconds] }, points: { scene: [indices] } }
   → capture moves the pointer at those seconds and records the moment
   → the video build draws the highlight from those same recorded moments
```

`cues` says *when* each region is spoken about. `points` says which of those the **hand** takes
part in; everything else is highlight-only and the cursor does not move. Keeping `points` short
is the whole reason they are separate.

Cue times are **narration-relative**, which makes them survive a script edit: re-resolve the
phrase against the new word timings and both instruments follow.

A selector that names its own text (`text:Daily briefing`) can derive its cue automatically.
Expect that to cover only some of them — good narration paraphrases the interface instead of
reading labels aloud, so most cues have to be written from the scene's own line.

## Positional alignment — cue *i* binds to region *i*

This is the most dangerous property in the design, because breaking it produces working
choreography aimed at the wrong things.

- **Never compact the region list.** Filtering out an unusable region renumbers everything
  after it and silently re-aims every later cue.
- An unresolvable selector **holds its place as null** and is reported by name.
- A region deliberately cued elsewhere gets a **null phrase**, not a missing entry. Make an
  explicit null distinguishable from an absent one, or "this region gets no highlight" is
  indistinguishable from "nobody said".

Assert `regions == phrases == resolved times` per scene. It costs nothing and catches the case
where someone adds a region and forgets its phrase.

## Cue timing: three traps

1. **Measure elapsed on the clip's clock, not the choreography's own start.** Cue times are
   relative to the start of the clip. Any scene whose setup runs on camera will otherwise fire
   every highlight late by exactly the setup duration — 11s and 12s in two real cases, landing
   well after the narration had moved on.
2. **Release overdue cues in sequence.** If setup overruns a scene's early cues they all become
   due at once and fire together: two highlights on screen instead of one moving to the next.
   Enforce a minimum gap — `max(cueTime, lastMark + 1.5)`.
3. **Fixed `wait:` steps are usually the real culprit.** In one measured case a scene had
   `wait 4000` and `wait 3000` between a state change and the choreography starting: seven
   seconds of stopwatch for work that took under one. Replacing them with conditions (`waitJs`
   on something that has to become true) took setup from 12.2s to 6.2s and the first cue's lag
   from +8.2s to +2.4s.

A healthy first-cue lag is about **−0.4s** — the deliberate lead, the pointer arriving just
before the phrase. A large *negative* lag is normal on scenes with a real click: the click's
own highlight precedes the spoken cue.

## Highlights move; they do not multiply

Give every highlight a dwell, then **truncate each at the start of the next**. Without this,
consecutive highlights overlap and two boxes appear at once. On a control that shifts position
between them, that reads as one box split across two things.

Mind the size floors. A rectangle filter that rejects small regions will silently drop the
highlight on a badge or a dropdown, which are legitimately about 30px tall — and if the floor
exists in more than one place, fixing one and rebuilding looks like the fix did nothing.

### A control that changes shape needs two measurements

A selector's text and its geometry do not change at the same time. Setting a `<select>`'s value
updates its text immediately; the surrounding layout only shifts when the component re-renders,
often half a second later. One rect cannot fit both states. Three capabilities make this
correct, and all three are generally useful:

- **`point`** — glide the pointer to a target and record the highlight *during setup*. Without
  it, a change the narration attributes to a control can never be pointed at before it happens,
  because the choreography only starts once setup is done.
- **`clearHighlight`** — end the current highlight at an exact moment. The text changes before
  the layout does, so the old box must come off when the *name* changes, not when the *layout*
  settles. A brief gap with no box beats a box around the wrong thing.
- **`waitMoved`** — wait until the target's own geometry changes. Text-based repaint signals are
  guesses about which words survive a re-render; in one case the chosen phrase persisted after
  the change and the wait timed out. Asking the element directly cannot be fooled that way.

## A pointer that behaves like a person

`build-cursor.mjs` draws the pointer and a click ring, as SVG in the same headless browser
the capture step uses, screenshotted over a transparent background. `build-video.mjs` then
flies the pointer to each highlighted region so that it **arrives exactly as that region's
highlight appears** — and on arrival it dips a couple of pixels, the way a hand does, while a
ring expands and fades from the click point. That is what makes it read as *using* the
product rather than floating over it. The pointer also carries over from where the previous
scene left it, rather than teleporting to a fresh start position at every cut, so the whole
piece feels like one continuous session.

Its path is a sum of `clip()` ramps, one per target plus two for the press, which telescopes
exactly to the final position; it is not built from branching, because a nested `if()` is
mis-evaluated here. The ripple works because `scale` with `eval=frame` reads the timestamp
and `fade`'s alpha applies to the overlay's own stream — so it can grow and dissolve at once.
Each ring input must be **looped**: as a single-frame input its filters would only ever be
evaluated at t=0, and the ripple would sit there frozen.

Keep the pointer small — about 20×32 for a 1920-wide frame, close to a real cursor. Larger
reads as a presentation prop.

Set `DEMO_VIDEO_CURSOR=0` to render without it. A scene with no highlights gets no pointer,
so an opening or summary scene stays still.

**What this is not.** Over *still* screenshots the interface does not visibly respond to the
click within the scene — the *next* scene shows the result. That reads as cause and effect and
is a long-standing click-through convention. When a demo needs the interface to respond within
the scene, record it: see [`live-capture.md`](live-capture.md), which swaps the still for a
clip and leaves every overlay described here unchanged.

## Titles that fly in

`build-title-cards.mjs` renders one card per scene — rounded corners, an accent bar, a drop
shadow, real typography — in the browser, then `build-video.mjs` flies the whole card in from
off the left edge with a cubic ease-out, holds it long enough to read, and eases it back out.

It settles as a **lower-third near the left edge**, which is where a viewer expects a chapter
label and keeps it clear of the screen it is labelling. Resist the temptation to put anything
else on the card: an act or section number reads as scaffolding to an audience who never saw
your outline, and it looks odd when the first title in a cut happens to be "Act 2".

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
3. **`scale` with `eval=frame` also reads `t`**, and `fade` can animate alpha on the same
   stream — measured on a test render at 0.1s/0.5s/0.95s: 31px bright, 77px bright, 124px
   faded. That combination is what makes the click ripple possible.

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
