// Ties each of a scene's spotlights to the moment its phrase is actually spoken, so a
// highlight emphasises the point being made rather than appearing at the top of the scene
// and sitting there. Timing comes from the real per-word timestamps captured during
// synthesis, so it re-anchors itself whenever the narration is re-recorded.
//
// Configure per project: map a scene id to one phrase per spotlight region, in the order
// the scene lists them (see scene-schema.md for declaring more than one region). A scene
// with no entry keeps its highlight but shows it early.
//
//   export const SPOTLIGHT_CUES = {
//     '03-briefing': ['a daily briefing nobody compiled by hand', 'a small badge marks'],
//     '07-access':   ["still isn't allowed into a confidential record"],
//   };
//
// Phrases match on words only — case and punctuation are ignored — so they must follow the
// narration's WORDING but not its punctuation. If an edit rewords the line, the phrase stops
// matching; build-video.mjs prints a warning naming the scene so it can be re-anchored
// rather than silently degrading.
export const SPOTLIGHT_CUES = {};

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

// Where a phrase is spoken, in seconds from the start of the clip. Null if the wording is no
// longer present, which the caller reports rather than mistiming the highlight.
export function findPhrase(words, phrase) {
  const spoken = (words || []).filter((w) => w.kind !== 'punct');
  const target = phrase.split(/\s+/).map(norm).filter(Boolean);
  if (!spoken.length || !target.length) return null;

  for (let i = 0; i + target.length <= spoken.length; i++) {
    let ok = true;
    for (let j = 0; j < target.length; j++) {
      if (norm(spoken[i + j].text) !== target[j]) { ok = false; break; }
    }
    if (!ok) continue;
    const first = spoken[i];
    const last = spoken[i + target.length - 1];
    return { start: first.start, end: last.start + last.dur };
  }
  return null;
}
