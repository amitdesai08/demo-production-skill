# Accessible outputs — captions, transcript, and an audio-only track

A demo video that only works if you can see it and hear it excludes people, and in most
organisations it also can't be published. The pipeline produces the accompanying formats from
the same source as the video, so they can't drift out of step with it and nobody has to
transcribe anything by hand.

| Command | Produces | For |
|---|---|---|
| `node build-captions.mjs` | `.vtt`, `.srt`, `.ttml` | The web/HTML player, most video tools, and enterprise video platforms |
| `node build-transcript.mjs` | `.txt` | Screen readers, reviewers, search, translation |
| `node build-audio-track.mjs` | `.mp3` | Listening without the screen |

All three take the same `--teaser`, `--manifest`, `--out` and `--scenes` flags as
`build-video.mjs`, so each cut gets its own matching set.

## Captions are timed from the voice, not estimated

Two ways of generating captions look fine on scene one and fall apart by scene twelve:

- **One cue per scene.** A thirty-second line becomes six lines of text sitting on screen at
  once, covering the product you are trying to show.
- **Estimated timing.** Dividing a scene's duration by its word count ignores the real pauses
  in speech, so the captions run steadily further ahead of the voice as the scene goes on.

Both are avoided by capturing the truth at synthesis time. `narrate.mjs` uses the Speech SDK
rather than the REST endpoint for exactly this reason: the SDK raises a `wordBoundary` event
per word, and REST does not. Those timings are written next to the audio as
`build/audio/<scene-id>.words.json`, and captions are cut from them.

`lib/caption-chunks.mjs` then splits each scene into cues of at most two lines and ~84
characters, breaking at strong punctuation where there is enough text to justify it.

Captions are **not burned into the picture**. A viewer who needs them turns them on, a viewer
who doesn't gets a clean frame, and either way the text stays selectable and translatable.

### If a scene has no word timings

Audio recorded before word capture existed has no `.words.json` sidecar. `narrate.mjs` treats
such a clip as missing and re-records it. If captions still report:

```
  ! 01-home: no word timings — captions for this scene are one block.
```

re-run `narrate.mjs` for that manifest.

## One timeline, four consumers

The video, the captions, the transcript and the audio track must agree to the frame. They do
because none of them works the timeline out for itself — they all call `lib/track-timeline.mjs`,
which walks the same scenes in the same order using the beats in `lib/timing.mjs` and measures
each clip with ffprobe rather than trusting the manifest's rounded estimate.

```js
// lib/timing.mjs
export const HOLD_AFTER_NARRATION = 1.4;  // silence held after a scene stops speaking
export const LEAD_IN_SILENCE      = 0.7;  // silence before the next scene speaks
```

These two values are also the only section-level pauses in the piece. Without the lead-in, the
cut and the next line of narration land on the same frame and the whole thing reads as one
continuous take over changing pictures instead of a series of distinct points. The voice's
own intra-scene pacing is deliberately left alone — see
[`narration-style.md`](narration-style.md).

**If you change either value, change it in `lib/timing.mjs` only.** A caption file that
computes its own timeline drifts a little further out of step with every scene, and the error
is only visible near the end.

## Describing what can't be heard

If a scene's point is carried by what is *on the screen* rather than by what is said, record a
described alternative for that scene and name it in the `DESCRIBED` map at the top of
`build-audio-track.mjs`. Only those scenes are substituted; the rest of the track is the same
audio as the video.

## A transcript is also the cheapest review loop you have

Beyond accessibility, the `.txt` is the artifact reviewers actually engage with: the wording of
a demo is far easier to fix as text than after it has been spoken, and a reviewer can comment
on it without scrubbing a video. Circulate it before you spend Speech budget re-recording.
