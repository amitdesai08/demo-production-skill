# Designing a new audience track

## Step 1 — Research the audience's real value proposition

Do not start writing narration until you can answer, with a citation to something real in the
product or its docs, "what does this audience actually care about, and what in this product
concretely serves that?" Never invent a feature, a statistic, or a percentage that doesn't
trace to something real.

Common audience archetypes and what they actually care about:

- **Technical / IT / security audience** — identity and access enforcement, data boundaries,
  what an AI agent or integration can and can't reach, audit trails, the deployment model,
  extensibility. Ground every claim in a real mechanism (an actual enforcement point in the
  code, a real config flag) rather than marketing language.
- **Business / executive audience** (a buyer, not a user) — what this takes off their team's
  plate, throughput, ease of adoption, why this over the status quo. This is the one audience
  where productivity/ROI framing is appropriate — but see the "no invented numbers" rule below;
  every saving must tie to a **named, specific task** the product removes, never a percentage
  or speed claim that can't be substantiated.
- **Practitioner / daily-user audience** — does this help me do my actual job, is the
  information trustworthy, does it show its sources. Usually the one audience where ROI framing
  should be deliberately avoided in favour of decision-grade detail.

Before inventing a name for a capability, check whether the product's own team already has an
internal name for it (a code comment, an internal doc, a module name) and use that instead of
guessing at a plausible-sounding one.

## Step 2 — Design the acts, then the scenes

A full walkthrough is 6–9 acts, one scene per act beat, roughly 15–17 scenes and 8–18 minutes of
narrated video. Write the act list first — the acts are the outline; scenes fill it in.

A lightning cut is its **own fresh capture**, not a slice of the walkthrough — its own pacing,
typically 6–9 scenes, standing alone as a 10-minute (3-minute-safe-cut) story with the same
claims but fewer stops.

A runbook **reuses** the walkthrough's already-captured frames (via `cuts.mjs`'s `use:
'<scene-id>'` references), with denser, more implementation-facing narration overrides — naming
real config, routes, or file paths — for a presenter who is delivering the demo but isn't its
author.

## Step 3 — The three markdown scripts, exact structure

Each of the three documents follows this shape:

**Walkthrough doc:**
- Header: who it's for, how long, when it was last checked against the product
- A pointer to the narrated version, and which scenes file builds it
- "Before you start" — the spoken disclaimer line to say out loud, any setup needed
- One section per act: a short "what to click" list, then one or more blockquoted spoken lines
  matching (or closely paraphrasing) the scene's `say` text
- "The questions you will actually be asked" — a Q&A table, one-line answers
- "The one-page card" — a compact table mapping act → screen → the one line that lands
- Named "traps" — things a presenter commonly gets wrong for this specific audience
- "The one-paragraph version" — a single blockquote summarising the whole pitch

**Lightning doc:**
- Same disclaimer pattern, shorter
- A single table: beat / what to do / what it proves
- A named "N-minute cut" pointing at the 2–3 beats that carry the whole story alone
- Close + ask
- "What it addresses for [audience]" table
- "If you are asked" — hands off cost/security/architecture questions to the walkthrough's Q&A
  rather than duplicating them

**Runbook doc:**
- A "which document do I want?" callout at the top, routing a reader to the walkthrough or
  lightning doc instead if they don't need this level of detail
- "The canonical spine" — a numbered list of beats in a fixed order, plus a "safe fallback" (a
  shorter subsequence) and a "60-second pre-flight" checklist
- One numbered section per beat, denser than the walkthrough, naming real routes/config/paths
- "Quick reference" — a feature → screen/config mapping table
- "Troubleshooting" — real, specific failure modes and fixes

## Step 4 — The "no invented numbers" discipline

This is a hard rule, not a suggestion, and it's what makes a business/ROI-framed track credible
instead of a marketing pitch:

- Never write "X% faster" or "saves N hours" — there's no way to substantiate it, and the
  moment an audience catches one invented number, they stop trusting the rest.
- Instead, name the **specific manual task removed** and the **mechanism that removes it**.
  "A report is normally a manual pull-together at quarter end; here it's a live view of the
  same record, generated on demand" is a claim you can defend, because it describes what the
  product mechanically does, not a claim about how much time that saves any particular
  customer.
- Any on-screen number you assert (a count, a label) must be verified live against the actual
  product at write time, and documented as "current as of [date]" wherever your project
  indexes its recordings, because demo data changes.
