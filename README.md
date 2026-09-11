# demo-production-skill

A portable GitHub Copilot skill (and a working reference implementation) for building
high-quality narrated product demos: real screenshots of a running product, calibrated
natural-sounding voiceover, and three ready-to-use assets per audience — an interactive
click-through, an MP4, and a markdown script a live presenter can read from.

**No dependency on any specific product or platform.** The methodology (audience research,
narration-quality calibration, the three-asset model) is entirely generic. The
`reference-implementation/` folder is a small, working pipeline (capture → narrate → build)
you wire up to whatever you're demoing — see `reference-implementation/CONFIGURE.md`.

## What's in here

```
demo-production/            the skill — this folder name matches SKILL.md's `name:`
├── SKILL.md                 the decision flow; everything else loads on demand
└── references/              10 topic files, each linked directly from SKILL.md
    ├── ai-narrative-generation.md   the story on its own, before any capture
    ├── new-track-guide.md           audience research + act structure
    ├── narration-style.md           the measurable natural-speech bar
    ├── scene-schema.md              manifest shape + step vocabulary
    ├── capture-quality.md           real-resolution capture, verified
    ├── live-capture.md              recording the product being driven
    ├── on-screen-emphasis.md        cursor, highlights, chapter titles
    ├── accessible-outputs.md        captions, transcripts, audio description
    ├── pipeline-reference.md        exact commands and the traps
    └── external-resource-access.md  whose credential captures a gated resource

reference-implementation/   a working, product-agnostic capture → narrate → build pipeline
├── CONFIGURE.md             read this first — the four things to wire up
├── example/                 a tiny sample app, so the pipeline can be proven before it
│                           touches anything of yours
└── example-azure/           the same, against a real Azure portal sign-in

scripts/validate-skill.mjs  checks the skill against the Agent Skills requirements
install.ps1 / install.sh    copy it into a repo, or into your own skills folder
```

## Installing the skill into a project

### Option A — personal, across all your own repos (simplest)

One command, and it is available in every workspace you open, now and in future sessions:

```bash
./install.sh --personal      # macOS / Linux
```
```powershell
./install.ps1 -Personal      # Windows
```

That writes to `~/.agents/skills/`, `~/.claude/skills/` and `~/.copilot/skills/`. The files
are identical, so the skill is there whichever tool you happen to open.

### Option B — shared with a team, per project

Clone or download this repo, then run the installer from inside it, pointing at the target
project:

```bash
./install.sh --target-repo ../some-project                              # .github/skills
./install.sh --target-repo ../some-project --target claude              # Claude Code
./install.sh --target-repo ../some-project --target all --with-reference-implementation
```
```powershell
./install.ps1 -TargetRepo ../some-project
./install.ps1 -TargetRepo ../some-project -Target claude
./install.ps1 -TargetRepo ../some-project -Target all -WithReferenceImplementation
```

The target defaults to `github` (`.github/skills/demo-production`, what Copilot reads) and
also accepts `claude` (`.claude/skills/`), `agents` (`.agents/skills/`, a shared convention
several tools read) or `all`. Adding the reference implementation also copies it to
`<target>/demo/` as a starting point. Commit the result and every teammate picks it up on
their next pull.

### Option C — manual copy

No tooling dependency beyond plain files — copy the `demo-production/` folder into any of the
locations an agent session checks (`.github/skills/`, `.agents/skills/`, `.claude/skills/` for
a project; `~/.copilot/skills/`, `~/.agents/skills/`, `~/.claude/skills/` for yourself).
**Keep the folder name.** Every runtime addresses a skill by its directory, and it has to
match the `name:` in `SKILL.md`.

## Using it

Ask for the thing you want, not for the skill:

- "build a technical-audience demo for this product"
- "add a lightning cut to our existing walkthrough"
- "the narration on our demo sounds stilted, fix it"
- "add captions and a transcript to the demo"

The `description` is written so these phrasings trigger it. From there `SKILL.md` drives the
workflow and pulls in only the reference files a given step needs.

## Trying it without a real product

The reference implementation ships a small sample app, so the pipeline can be proven end to
end before it touches anything of yours:

```bash
cd reference-implementation
npm install
node example/app/serve.mjs &
node capture.mjs --scenes example/scenes.mjs
```

Then follow [`CONFIGURE.md`](reference-implementation/CONFIGURE.md) to point it at your own
product. Narration needs an Azure AI Speech resource and the video build needs ffmpeg;
neither is required to produce the interactive click-through.

## Developing it

```bash
node scripts/validate-skill.mjs
```

This checks the documented requirements rather than preferences: frontmatter field limits,
the 500-line body budget, that every reference file is reachable directly from `SKILL.md`,
that long references carry a table of contents, and that no path uses backslashes. CI runs it
on every push, along with a real install into a throwaway repo — a broken installer is the
one failure that shows up on somebody else's machine instead of yours.

## Keeping this updated

This repo is the source of truth. Improve the methodology or the pipeline here, then re-run
the installer anywhere an older copy landed.
