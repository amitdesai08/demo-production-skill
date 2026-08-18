# Narration style — the calibrated natural-speech bar

The narration is meant to sound like someone actually talking through a product, not a
document being read aloud. Below is the mechanical, measurable process that keeps narration at
that bar, instead of relying on "it sounds fine to me."

## Why this is measurable, not a matter of taste

`narrate.mjs`'s SSML shaping does exactly one transformation beyond the raw text: it turns every
em-dash surrounded by spaces into a **120ms forced `<break>`**:

```js
// from narrate.mjs's ssml() function
.replace(/\s+\u2014\s+/g, '<break time="120ms"/> ');
```

The neural voice already paces sentence and clause boundaries on its own — periods and commas
need no help. An em-dash is the *only* punctuation this pipeline treats specially, precisely
because the voice otherwise runs straight through it as if the words on either side were one
clause. That means **em-dash density is a direct, physical measurement of how many forced
pauses are stacked into a scene's audio** — five em-dashes in a scene is five extra beats of
hesitation, whether that was the intent or not.

Contraction density ("it's", "doesn't", "can't", "there's", "that's" vs. "it is", "does not",
"cannot", "there is", "that is") is the other half of the same signal: natural spoken English is
heavily contracted, and a narration written in fully-expanded formal register reads as written
prose being read aloud, not as someone talking.

## Calibrating your own bar

Before writing new tracks, write and narrate one small, deliberately well-crafted reference
scene set first (3–5 scenes), read it back, and iterate on it until it sounds right to you when
played. Then run the audit below on that reference set and treat its numbers as your project's
target bar for every track after it — the same way you'd establish a style guide before a team
of writers starts producing content against it. As a starting point, aim for roughly:

| Metric | Starting target (per scene) |
|---|---|
| Em-dash density | **≤ ~1** occurrence of `—` per scene (stricter, ~0.5, for a short/lightning cut) |
| Contraction density | **≥ ~2** contractions per scene |

### The exact audit commands (PowerShell)

Run this after writing or editing any scene file, **before** spending any Speech-synthesis
budget on it:

```powershell
$content = Get-Content scenes.mjs -Raw
$dashes = ([regex]::Matches($content, [char]0x2014)).Count
$scenes = ([regex]::Matches($content, "id: '")).Count
$contractions = ([regex]::Matches($content, "n't|(?<=[a-z])'s |(?<=[a-z])'re |(?<=[a-z])'ll |(?<=[a-z])'ve ")).Count
"scenes=$scenes dashes=$dashes perScene=$([math]::Round($dashes/$scenes,2)) contractions=$contractions perSceneC=$([math]::Round($contractions/$scenes,2))"
```

If a rewrite comes in above your target for em-dashes or below your target for contractions:
(a) convert most em-dashes to a period (split into two sentences) or a comma, keeping only the
rare one doing real dramatic work; (b) convert formal constructions to their contraction ("does
not" → "doesn't", "there is" → "there's", "cannot" → "can't", "it is" → "it's", "that is" →
"that's").

## The other narration rules (not measurable, but just as load-bearing)

- **No presenter-instructions.** The `say` text describes the product, never the act of
  presenting it. Banned patterns: "read this aloud", "ask it...", "now switch to...", "remember
  that number for later", "notice that...". Also avoid "it asks you" phrasing even when
  describing product behaviour — it reads as addressing the viewer directly.
- **Shorter sentences, not longer ones.** If a sentence needs three clauses to make its point,
  it's usually two sentences.
- **Avoid colons as a clause-joiner** in narration text, for the same reason as em-dashes — a
  colon-joined compound sentence tends to correlate with the same over-written, under-contracted
  register. If you find yourself reaching for one, it's usually a sign the sentence should just
  be split.
- **Grounded claims only, no invented statistics.** Any time-saving, capability, or comparison
  claim must trace to something real and verifiable in the product. This applies with extra
  force to a business/ROI-framed track — see `references/new-track-guide.md` for how to thread
  that needle without inventing a single percentage.
- **Double-check any on-screen fact you assert out loud** (a count, a label, a number) against
  the live product at write time — demo data moves, and a stale figure asserted confidently is
  worse than not mentioning it. Document which figures were current as of which capture date
  somewhere your project keeps its recordings index.

## Applying this to an edit, not just a fresh write

Run the same audit on the whole file after editing a few scenes in an existing manifest, not
just the lines you changed — a few added sentences with two em-dashes each can move a short
manifest's average more than expected.
