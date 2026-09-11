# Recording the product instead of screenshotting it

## Contents
- What it does and does not give you
- Aiming the recording at what the video highlights
- Hover, not click
- Clip length must equal the scene's narration
- Where a clip should start
- The encoder will lie to you — make it check itself
- Practicalities

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

## Clip length must equal the scene's narration

Frames arrive only when the page changes, so a clip's length cannot come from frame arrivals —
it has to be imposed. Build every clip to a target of
`LEAD_IN_SILENCE + narration seconds + HOLD_AFTER_NARRATION`, derived from the **real per-word
timestamps** the speech engine returns rather than an estimate.

Get it wrong and the video build compensates by playing the clip fast to fit, which produces
visibly hurried motion — the exact fault recording was supposed to remove.

**Budget the scene on the recording clock, not the wall clock.** Long waits (an assistant
composing an answer, a slow first load) should be cut from the recording — stop the screencast,
wait, restart — so the demo does not contain forty seconds of a spinner. That creates two
clocks: wall time, and recording time (wall minus everything cut). Anything deciding how much
scene is left must use recording time, or it charges the scene for seconds that never reach the
clip and ends the choreography early.

## Where a clip should start

Default: **after** the scene's setup steps. Setup length varies with how slow the screen was
that run, and it is not content — left in, every clip is a different length for reasons
unrelated to the story.

Exception: a scene **whose point is the change itself** — a control being operated, a filter
applied, a list narrowing in response. Those must start *before* the steps, or the clip opens
on the aftermath while the narration describes something already done. Make it an explicit
per-scene opt-in, and make sure the cue clock and the budget both agree with it.

## The encoder will lie to you — make it check itself

Assembling frames with ffmpeg's concat demuxer is the obvious approach and has three separate
traps, each silently producing a clip whose length disagrees with its timeline. All three were
found by measuring, none by reading documentation.

1. **The last entry's `duration` is ignored.** A list of `5s, 3s, 20s` encodes as 8.04s. The
   usual workaround — repeating the final file as an extra entry — is not optional.
2. **A long final hold is dropped even so.** `[0.04, 0.27, 0.05, 8.18]` encoded as 0.68s: the
   short frames were honoured and the eight-second hold vanished. Four equal 2s durations
   encoded correctly, so it is the long tail specifically.
3. **`-r 30` inflates the result.** Forcing a constant output rate over long holds turned a
   28.04s timeline into 32.97s.

Stop asking the demuxer to hold the last frame at all. Clone it and set the length explicitly:

```
ffmpeg -f concat -safe 0 -i list.txt \
  -vf "tpad=stop_mode=clone:stop_duration=<target>,fps=30" -t <target> \
  -c:v libx264 -preset medium -crf 16 -pix_fmt yuv420p out.mp4
```

Accurate to a single frame regardless of what the demuxer does with the tail.

**Have the encoder probe its own output** and report any disagreement over a second between the
encoded duration and the timeline it was handed. Return the *measured* duration, not the
computed one — that number maps the pointer track onto the clip, so a clip secretly nine seconds
longer than the code believes will misplace every pointer sample.

## Practicalities

- **ffmpeg is required by `capture.mjs`** in this mode, which it otherwise does not need.
- **Run the whole scene list, not a subset.** Scenes share browser state, and a partial run
  skips the navigation later scenes depend on.
- **A screenshot timeout no longer loses the clip.** Capturing a full-resolution screenshot
  while screencasting can time out; the scene is still recorded, and the run reports
  `[no screenshot]` rather than failing.
- Clips land in `build/clips/<scene-id>.mp4` and the manifest gains `video` per scene. Delete
  the clip and the scene silently falls back to its screenshot, so the two can be mixed.
