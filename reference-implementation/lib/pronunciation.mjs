// Words the voice gets wrong, and how it should say them instead. Both maps are optional —
// an empty map is fine, and most projects only need a handful of entries.
//
// Diagnosing a mispronunciation is a listening job, but fixing one is not guesswork: give
// the voice IPA and it says exactly that. Print the shaped SSML for a scene before you
// re-synthesise (see narrate.mjs --print-ssml) so a bad phoneme or a regex that matched too
// much is caught without spending Speech calls on it.

// Proper nouns a generic voice reads by guesswork. Matched EXACTLY, case-sensitively, so a
// name that also appears as an ordinary word elsewhere is not caught by accident.
export const NAME_PHONEMES = {
  // Anagonye: 'ˌænəˈɡoʊnjeɪ',
};

// Ordinary words, matched case-insensitively on a word boundary because they appear
// mid-sentence in normal prose and may be capitalised at the start of one.
export const WORD_PHONEMES = {
  // Common in AI demo narration and reliably wrong out of the box: the voice says
  // "AY-gentic" where the word is the unstressed "uh-JEN-tik".
  agentic: 'əˈdʒɛntɪk',
};

// Wraps every known term in a <phoneme> tag. Runs on already-escaped text, before any other
// SSML is added, so the tags it inserts are never themselves re-escaped or matched again.
export function applyPronunciations(text) {
  let s = text;
  for (const [name, ph] of Object.entries(NAME_PHONEMES)) {
    s = s.replaceAll(name, `<phoneme alphabet="ipa" ph="${ph}">${name}</phoneme>`);
  }
  for (const [word, ph] of Object.entries(WORD_PHONEMES)) {
    s = s.replace(new RegExp(`\\b${word}\\b`, 'gi'),
      (m) => `<phoneme alphabet="ipa" ph="${ph}">${m}</phoneme>`);
  }
  return s;
}
