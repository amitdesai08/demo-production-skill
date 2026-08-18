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
demo-production-skill/
├── skill/                      the Copilot skill itself
│   ├── SKILL.md
│   └── references/
│       ├── scene-schema.md
│       ├── narration-style.md
│       ├── new-track-guide.md
│       └── pipeline-reference.md
├── reference-implementation/    a working, product-agnostic capture/narrate/build pipeline
│   ├── CONFIGURE.md             read this first — the 4 things to wire up for your product
│   ├── capture.mjs
│   ├── narrate.mjs
│   ├── build-player.mjs
│   ├── build-video.mjs
│   ├── build-cut.mjs
│   ├── scenes.example.mjs
│   ├── cuts.example.mjs
│   ├── package.json
│   └── lib/cdp.mjs
└── install.ps1                  copies the skill into another repo
```

## Installing the skill into a project

### Option A — personal, across all your own repos (simplest)

Copy `skill/` to your personal Copilot skills folder once, and it's available in every
workspace you open, in this and future sessions:

```powershell
Copy-Item -Recurse -Force "path\to\demo-production-skill\skill" "$HOME\.agents\skills\demo-production"
```

(VS Code Copilot also checks `~/.copilot/skills/` and `~/.claude/skills/` — use whichever your
tooling reads.)

### Option B — shared with a team, per project

Clone or download this repo, then run the installer from inside it, pointing at the target
project:

```powershell
./install.ps1 -TargetRepo "C:\path\to\some-other-project" [-WithReferenceImplementation]
```

This copies `skill/` to `<target>\.github\skills\demo-production\` (so any teammate's Copilot
session in that repo picks it up automatically once committed), and — if
`-WithReferenceImplementation` is passed — also copies `reference-implementation/` to
`<target>\demo\` as a starting point. Commit both into the target repo.

### Option C — manual copy

There's no tooling dependency here beyond plain files — copy `skill/` into any of the
locations a Copilot session checks for skills (`.github/skills/<name>/`,
`.agents/skills/<name>/`, `.claude/skills/<name>/` for a project; `~/.copilot/skills/<name>/`,
`~/.agents/skills/<name>/`, `~/.claude/skills/<name>/` for yourself only), keeping the folder
name `demo-production` to match `SKILL.md`'s own `name:` field.

## Using it

Once installed, ask your Copilot session things like "build a technical-audience demo for
this product," "add a lightning cut to our existing walkthrough," or "the narration on our
demo sounds stilted, fix it" — the skill's description is written to be discovered by prompts
like these. See `skill/SKILL.md` for the full decision flow.

## Keeping this updated

This repo is the source of truth. If you improve the methodology or the reference pipeline,
update it here and re-run `install.ps1` (or re-copy `skill/`) into any project that installed
an earlier copy.
