# AI-generated demo narrative — the fast path

A full track (walkthrough + lightning + runbook, all three narrated and captured) is a
production run. Most of the time what's actually wanted first is much smaller: **a script** —
the act structure and the scene-by-scene narration lines — that a human can read, correct and
approve *before* anyone spends a single capture or a single Speech-synthesis call on it.

That script is the **demo narrative**, and it is a deliverable in its own right, not just an
intermediate step. This file covers producing one with AI, on request, as a standalone
markdown document — independent of running any part of the capture → narrate → build pipeline.

## When to reach for this instead of a full track

- Someone asks for "a demo narrative", "a demo script", "a narrative for \<audience\>", or "what
  would we say to \<audience\>" — without asking for a recording, a click-through, or a runbook.
- You want a fast, cheap way to pressure-test a new audience angle before committing to a full
  production run (which costs real capture time and Speech-synthesis budget).
- A reviewer wants to read and mark up the *words* first, separately from watching a video.

If the ask is instead "build/record/produce a demo for \<audience\>", treat the narrative as
**step 1 of that larger job** (see the main [SKILL.md](../SKILL.md) workflow's "Building a new
demo track") — write it first, get it approved, then continue into scene manifests and the
production pipeline. The narrative you produce here is not throwaway: its acts become the
manifest's `ACTS` array verbatim, and each scene's narration line becomes that scene's `say`
field, so writing it carefully now is what makes step 4 of the full workflow (scene manifests)
fast later.

## Decide vs. ask — don't stall on things that have a sensible default

- **Audience unstated or vague** ("make a demo", no named audience) — **ask**: *"Who is this
  narrative for — a specific role, or a general audience?"* Don't guess an audience; the whole
  point of the research step is that different audiences want different facts, and a guess here
  compounds into every later step.
- **Length unstated** — default to a **full-length narrative** (15–17 scenes) without asking; a
  longer draft is easy for a reviewer to cut down, while a lightning-length draft asked for too
  early risks leaving out a beat that turns out to matter. Say which length you defaulted to.
- **Whether to continue past the draft into a full production run** — **always ask** before
  moving from the approved narrative into scene manifests and the capture pipeline, even if the
  original request sounded like it wanted a full track eventually. Producing the narrative is
  cheap; capture and Speech-synthesis are not, and a human should read the draft before that
  cost is spent, not just imply approval by not objecting.

## What the agent actually does

1. **Research the audience, grounded in the real product** — same rule as every other track: no
   invented feature, statistic, or terminology. If a repo is open, grep the product's own code
   and docs for what it actually does and how the team already names it internally, using the
   audience checklist in [`new-track-guide.md`](new-track-guide.md)'s research step. If there's
   no repo to grep — a live URL, a summary-only ask — ask the user directly rather than filling
   the gap with a plausible-sounding guess. Do not skip this step just because the deliverable
   is "only" a document — an ungrounded narrative fails the same way an ungrounded video does,
   just cheaper.
2. **Draft the act list** — 6–9 acts, one line each, following [`new-track-guide.md`](new-track-guide.md).
   State the act list to the reader before writing a single scene.
3. **Draft one narration line per scene beat** — ~15–17 scenes for a full-length narrative, ~6–9
   for a lightning-length one. Every factual claim in a line carries its own basis (a file, a
   route, a doc section, or a UI label) — write the basis down next to the line as you draft it,
   not after, or it gets lost.
4. **Run the narration-style audit on the draft immediately** — the same measurable bar as a
   real scene file, from [`narration-style.md`](narration-style.md): em-dash density ≤ ~0.9 per
   scene, contraction density ≥ ~2.3 per scene. A narrative draft that fails this audit is not
   "close enough because it's just a draft" — it is the exact text that becomes a scene's `say`
   field if the narrative is later promoted to a full track, so it has to clear the bar now.
5. **Apply the "no invented numbers" rule** from [`new-track-guide.md`](new-track-guide.md) for
   any business/ROI-framed line — name the manual task removed and the mechanism that removes
   it, never a percentage or a time saving that can't be substantiated.

## Output format

Write the narrative wherever fits the target project's own conventions — a `docs/demos/` or
`demos/` folder if one already exists, `NARRATIVE-<name>.md` next to the scene manifest you'll
write next, or just as a chat response if there's no repo to write into at all. Ask if it's
genuinely unclear where it should live. Keep it to exactly these sections — this is a working
script, not a marketing doc:

```markdown
# Demo narrative — <audience/track name>

**Audience:** who this is for, one sentence.
**Length target:** full (15–17 scenes) | lightning (6–9 scenes).
**Researched from:** the files/docs/routes actually grepped for the research step — list them.

## Acts

1. <Act title>
2. <Act title>
...

## Scenes

### <n>. <scene title> — Act <n>

- **Screen:** where this is captured (route, tab, panel).
- **Say:** "<the narration line, verbatim, as it would be spoken>"
- **Basis:** <file path, API route, or UI label this line traces to>

(repeat per scene)

## Style audit

- Em-dash density: <measured value> (target ≤ 0.9/scene, lightning ≤ 0.5/scene)
- Contraction density: <measured value> (target ≥ 2.3/scene)
```

## Handing it off

Once a human has read and approved the narrative:

- **To go no further** (the ask really was just the script) — it's done; the markdown file is
  the deliverable.
- **To turn it into a full track** — go to the main [SKILL.md](../SKILL.md) workflow's
  "Building a new demo track", starting at step 4 (write the scene manifest). The narrative's
  act list becomes the manifest's `ACTS`, and each scene's approved `Say:` line drops straight
  into that scene's `say` field — the research and the writing are already done, so the
  remaining work is capture-specific (screen, spotlight, scrollTo per the step vocabulary in
  [`scene-schema.md`](scene-schema.md)), not narrative work.
