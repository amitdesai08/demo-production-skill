// Splits a scene's narration into caption-sized cues and times them from the real per-word
// timestamps captured during synthesis (see narrate.mjs), rather than estimating.
//
// Two things this exists to avoid, both of which look like bugs to a viewer:
//   - One cue per scene. A 30-second line becomes six lines of text sitting on screen at
//     once, covering the picture.
//   - Estimated timing. Distributing a scene's duration by word count ignores the real
//     pauses in speech, so captions drift ahead of the voice as a scene goes on. Word
//     timestamps remove the guesswork entirely.

const MAX_LINE = 42;
const MAX_CHARS_PER_CUE = MAX_LINE * 2;
// Don't break right after a short lead-in clause just because it ended in punctuation.
const MIN_BREAK_LEN = 24;

// At most two display lines: the second takes whatever is left even if it runs slightly
// long, rather than spilling onto a third line.
function wrapLines(text, maxLen = MAX_LINE) {
  const words = text.split(/\s+/);
  let line1 = '';
  let i = 0;
  for (; i < words.length; i++) {
    const candidate = line1 ? `${line1} ${words[i]}` : words[i];
    if (candidate.length > maxLen && line1) break;
    line1 = candidate;
  }
  const line2 = words.slice(i).join(' ');
  return line2 ? `${line1}\n${line2}` : line1;
}

// No space before a punctuation mark when rebuilding text from tokens.
function renderTokens(tokens) {
  let text = '';
  for (const t of tokens) text += t.kind === 'punct' ? t.text : (text ? ` ${t.text}` : t.text);
  return text;
}

// Returns [{ text, start, end }] — one entry per on-screen cue. Breaks at a strong
// punctuation mark once there is enough text to be worth its own cue, and otherwise at the
// character limit. `start`/`end` are absolute: pass the scene's start time in.
export function buildCues({ words, start, end }) {
  const cues = [];
  let bucket = [];
  const flush = () => {
    if (!bucket.length) return;
    const first = bucket[0];
    const last = bucket[bucket.length - 1];
    cues.push({
      text: wrapLines(renderTokens(bucket)),
      start: start + first.start,
      end: start + last.start + last.dur,
    });
    bucket = [];
  };

  // The engine sometimes reports a punctuation boundary whose text is the whole remaining
  // span of the line rather than the mark itself, with timings that run backwards. Taken at
  // face value it becomes a cue holding the rest of the scene, on one unwrapped line, on
  // screen for a few milliseconds. The words it covers all arrive as their own tokens
  // anyway, so it is dropped rather than trusted — including in recordings made before
  // narrate.mjs started discarding it at source.
  const usable = words.filter((t) => !(t.kind === 'punct' && t.text.trim().length > 3));

  for (const tok of usable) {
    if (renderTokens([...bucket, tok]).length > MAX_CHARS_PER_CUE && bucket.length) flush();
    bucket.push(tok);
    const strongBreak = tok.kind === 'punct' && /[.!?:;]/.test(tok.text);
    if (strongBreak && renderTokens(bucket).length >= MIN_BREAK_LEN) flush();
  }
  flush();

  if (!cues.length) return [];

  // Dropping a blob can strand the mark that followed it as a cue of its own — a full stop
  // alone on screen for a third of a second. Fold anything with no words in it back into a
  // neighbour rather than showing it.
  for (let i = cues.length - 1; i >= 0; i--) {
    if (/[\p{L}\p{N}]/u.test(cues[i].text)) continue;
    if (i > 0) {
      cues[i - 1].text += cues[i].text;
      cues[i - 1].end = Math.max(cues[i - 1].end, cues[i].end);
    } else if (cues.length > 1) {
      cues[1].start = Math.min(cues[1].start, cues[i].start);
    } else {
      continue;
    }
    cues.splice(i, 1);
  }

  cues[cues.length - 1].end = end;
  return cues;
}
