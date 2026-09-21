# demo-production-skill

A portable Agent Skill (and a working reference implementation) for building high-quality
narrated product demos: real screenshots of a running product, calibrated natural-sounding
voiceover, and three ready-to-use assets per audience — an interactive click-through, an MP4,
and a markdown script a live presenter can read from.

**Works with [Microsoft Copilot Cowork](#option-d-microsoft-copilot-cowork), GitHub Copilot,
Claude Code, and other Agent Skills-compatible assistants.**

**No dependency on any specific product or platform.** The methodology (audience research,
narration-quality calibration, the three-asset model) is entirely generic. The
`reference-implementation/` folder is a small, working pipeline (capture → narrate → build)
you wire up to whatever you're demoing — see `reference-implementation/CONFIGURE.md`.

## New to this? Read this bit first

**What a "skill" is.** A folder of markdown files that teaches your AI assistant how to
do one job properly. You install it once. After that, your assistant reads it automatically
whenever you ask for something it covers. There is no command to run, no button, and nothing
to import in your code.

**What that means here.** You do not have to learn this pipeline. *You* describe the demo you
want in plain English; the assistant is the one that reads the instructions, writes the scene
file, runs the capture, and builds the video. Your job is to point it at a product, answer a
couple of questions, and review what comes out.

**The whole thing, start to finish:**

1. **Install it** (one command, below). This copies files into a folder your assistant reads.
2. **Open your project** in VS Code with Copilot or Claude Code, or start a Cowork session.
3. **Ask for what you want**, in your own words:
   > "Build a demo of this app for a technical audience."

   The assistant takes it from there — it will tell you if it needs something it cannot find.

If nothing seems to happen, see [When it doesn't trigger](#when-it-doesnt-trigger) at the end.

### What you get

For each audience you ask for, three things that stay in step with each other:

| Output | What it is |
|---|---|
| **Interactive click-through** | An `.html` file: real screens, narrated, click to advance. Opens in any browser, no install. |
| **Narrated MP4** | The same demo as a video, with captions, a transcript and an audio-only track. |
| **Presenter script** | A markdown file a colleague can read from while driving the product live. |

### What you need, and when

Nothing is required to *install* the skill. These are needed only when you actually build:

| Thing | Needed for | If you don't have it |
|---|---|---|
| [Node.js](https://nodejs.org) **22 or later** | Everything | Install it first — it is the only hard requirement. Older versions fail with `WebSocket is not defined`, which does not look like a version problem. |
| A running copy of your product | Capturing screens | The assistant can run it locally for you if the repo supports that. |
| An [Azure AI Speech](https://azure.microsoft.com/products/ai-services/ai-speech) resource | The voiceover | Skip it — you still get the click-through and the script, just no audio. |
| [ffmpeg](https://ffmpeg.org/download.html) | The MP4 | Skip it — the click-through does not need it. |

So the smallest useful setup is **Node plus something to demo**. Add Speech and ffmpeg when you
want the video.

## What's in here

```
demo-production/            the skill — this folder name matches SKILL.md's `name:`
├── SKILL.md                 the decision flow; everything else loads on demand
└── references/              12 topic files, each linked directly from SKILL.md
    ├── demo-intake.md               turning a repo/URL/resource into something capturable
    ├── ai-narrative-generation.md   the story on its own, before any capture
    ├── new-track-guide.md           audience research + act structure
    ├── narration-style.md           the measurable natural-speech bar
    ├── scene-schema.md              manifest shape + step vocabulary
    ├── capture-quality.md           real-resolution capture, verified
    ├── live-capture.md              recording the product being driven
    ├── hosted-app-capture.md        filming an app inside Teams, a portal or an iframe
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

### Option D: Microsoft Copilot Cowork

Cowork supports the same [Agent Skills open standard](https://learn.microsoft.com/microsoft-365/copilot/cowork/cowork-plugin-development#cross-platform-compatibility),
so the `demo-production/` skill works without rewriting its instructions.

To upload it:

1. Create a `.zip` whose root contains `SKILL.md` and the `references/` folder. Do not wrap
   them in an extra `demo-production/` directory inside the archive.
2. In Cowork, select **+** > **Customize** > **Skills**.
3. Select the arrow next to **Add**, select **Upload skill**, and choose the `.zip`.
4. Wait for it to appear under **Your skills**, then start a new Cowork session.

Create the correctly rooted archive from this repository with either command:

```powershell
Set-Location demo-production
Compress-Archive -Path SKILL.md,references -DestinationPath ../demo-production-cowork.zip -Force
```

```bash
(cd demo-production && zip -r ../demo-production-cowork.zip SKILL.md references)
```

Alternatively, copy the `demo-production/` folder into OneDrive at
`/Documents/Cowork/skills/demo-production/`. Cowork discovers skills in that folder at the
start of each session. See Microsoft's [Cowork skill instructions](https://learn.microsoft.com/microsoft-365/copilot/cowork/use-cowork#cowork-skills)
for current limits and sharing options.

Cowork can use this skill to research an audience, draft the narrative, plan scenes, and
produce presenter-ready content. The reference capture pipeline still needs a coding
environment with local filesystem access, Node.js, browser automation, and (for video or
voice) ffmpeg and Azure AI Speech. Cowork cannot run those local tools from the skill alone;
use VS Code/GitHub Copilot or Claude Code for the capture-narrate-build steps, or provide the
required capabilities through an approved Cowork plugin or connector.

## Using it

Ask for the thing you want, not for the skill. You never name it or invoke it — your assistant
matches your request against what the skill says it is for.

- "build a technical-audience demo for this product"
- "demo this repo"
- "add a lightning cut to our existing walkthrough"
- "the narration on our demo sounds stilted, fix it"
- "add captions and a transcript to the demo"

In Cowork, prompts such as "write a technical-audience demo narrative for this product" or
"turn these product materials into a presenter script" use the parts of the skill that do not
require local build tools. Custom skills are not currently supported in Cowork on mobile.

**What happens next.** The assistant works out what it is looking at, gets it running, and
asks you only what it genuinely cannot determine — usually which audience the demo is for.
Expect it to show you the **script first**, before spending any capture or voice budget, so you
can correct the story while it is still cheap to change. Say so if you would rather it just
built the whole thing.

**You stay in control of anything that costs or writes.** It will not sign in as you, take a
password in chat, or click through a live system without saying so first.

## When it doesn't trigger

If you ask and your assistant answers normally instead of building a demo, work down this list:

1. **Is it installed where your tool looks?** Copilot reads `.github/skills/` in the project
   and `~/.copilot/skills/` for you personally; Claude Code reads `.claude/skills/` and
   `~/.claude/skills/`. Running the installer with `--personal` covers all of them.
2. **Is the folder named `demo-production`?** The name must match the `name:` inside
   `SKILL.md`. Renaming the folder breaks it.
3. **Start a new chat.** Skills are picked up when a session starts, so one already running
   will not see a skill you just installed.
4. **Say more of what you want.** "Help me with this" matches nothing. "Build a narrated demo
   of this app" matches clearly.
5. **Check it is valid** by running `node scripts/validate-skill.mjs` from this repo. That
   reports anything structurally wrong with the skill itself.

If a *build* fails rather than the skill not triggering, the assistant will show the error.
The most common causes are Node not installed, the product not running, or ffmpeg missing for
the MP4 step — all covered in the requirements table above.

## Trying it without a real product

The reference implementation ships a small sample app, so the pipeline can be proven end to
end before it touches anything of yours. This is also the fastest way to see what the output
looks like:

```bash
cd reference-implementation
npm install
node example/app/serve.mjs &
node capture.mjs --scenes example/scenes.mjs
```

That writes screenshots to `build/shots/`. Add narration and build the click-through with
`node narrate.mjs` then `node build-player.mjs`, and open the `.html` it produces.

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
