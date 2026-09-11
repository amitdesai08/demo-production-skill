# Intake — turning "here's my thing" into a capturable subject

The user points at something and asks for a demo. That something is almost always one of three
shapes, and each needs a different amount of work before a single scene can be written:

| They gave you | What's unknown | First job |
|---|---|---|
| **A repo** (path, URL, or the open workspace) | How to run it, what's worth showing, whether it needs auth | Get it running locally |
| **A running URL** | Whether you can reach it, under whose identity | Establish access |
| **A cloud resource** (Foundry deployment, pipeline, portal blade) | Whose credential, which role | [`external-resource-access.md`](external-resource-access.md) |

Work through the steps below in order. Each one either **resolves itself from what's already
been said** or names the **one specific question** to ask. Do not batch a questionnaire at the
user — most of this is discoverable, and asking for what you could have read is its own kind of
sloppiness.

## 1. Identify the subject and the surface

If it's a repo, read it before asking anything. You are looking for five things:

- **How it runs** — `README`, `package.json` scripts, `docker-compose.yml`, `Makefile`,
  `azure.yaml`, a devcontainer. Prefer whatever the project's own docs say over inference.
- **What port/URL it serves on**, and whether there's a dev mode distinct from production.
- **Whether it has seeded or demo data.** This is the single biggest quality determinant. A
  product with realistic seeded content demos beautifully; one with an empty database does not
  demo at all. Look for `seed/`, fixtures, sample data, a demo/sandbox flag.
- **What the routes/screens are** — a router file, a nav component, a sitemap. This is the raw
  material for the act structure.
- **What auth it expects** — an `.env.example`, an identity provider config, a middleware that
  guards routes, or a demo/bypass mode.

If it's a URL with no repo, the surface has to be discovered by looking at it, which means
access comes first — go to step 3.

## 2. Get it running, and prefer local

Where you film, in descending order of preference:

1. **Locally, with seeded demo data.** Most controllable, no production risk, no credential
   question, and you can reset between takes. Default here unless there's a reason not to.
2. **A deployed dev/test environment.** Second best; check it has presentable data.
3. **The product inside its host application**, if that's how it's genuinely used and the story
   depends on it — see [`hosted-app-capture.md`](hosted-app-capture.md).
4. **Production.** Only when nothing else exists, and then read the safety rule in step 4.

Prove it runs and renders *before* writing scenes. Capture one throwaway scene end-to-end
(workflow step 1) — that also catches resolution problems while they're still free to fix.

## 3. Establish access — but only if it's actually needed

Ask in this order and **stop at the first one that works**:

1. **Does it need auth at all?** A locally-run app with seeded data usually does not. Many have
   an explicit demo/sandbox mode. Check before assuming.
2. **Can it run with local/dev credentials the repo already documents?** An `.env.example`
   naming a test key, a dev bypass flag, a local identity emulator.
3. **Is there a shared test/demo account** the user can name?
4. **The user's own interactive session.** For a browser click-through this is the normal
   answer for anything genuinely gated — a real capture needs a real signed-in session, not an
   API credential.
5. **A service principal / API credential.** Only for non-interactive subjects. It does *not*
   work for click-through capture. See [`external-resource-access.md`](external-resource-access.md).

**How to prompt, when you must:**

- Ask for the *minimum* — which environment, which account, which role. Not a credential dump.
- **Never ask the user to type a password, token, secret or key into the conversation**, and
  never write one into a scene file, capture plan, log, or committed config. Secrets go in the
  environment or a gitignored file the user creates themselves.
- For an interactive sign-in, the right pattern is a **persistent browser profile**: launch the
  capture browser with a dedicated profile directory, have the user sign in **by hand, once**,
  and every later run reuses that session. Automating a login form is fragile, usually violates
  the identity provider's terms, and breaks on MFA.
- Prompt at the moment it's needed, not up front "just in case". If the demo turns out to run
  entirely on seeded local data, you never had to ask.

## 4. Confirm scope before capturing

Three things to settle explicitly, because getting them wrong is expensive:

- **Will the capture write anything?** Clicking through a real environment can create, edit, or
  send. Enumerate any step that mutates state and get it approved, or find a read-only path. In
  production, assume every click is real.
- **Is any of the visible data real?** Customer names, financials, PII, anything under NDA. If
  the environment holds real data, either film a seeded one or agree what must not be on screen
  — before the capture, not during review.
- **What's the story?** Audience, length, and the acts. See
  [`new-track-guide.md`](new-track-guide.md), and generate the narrative for approval first
  ([`ai-narrative-generation.md`](ai-narrative-generation.md)) rather than capturing on a guess.

## Nothing in this skill is product-specific

The pipeline drives whatever URL your scenes name, in whatever browser profile you point it at.
Every mechanism here — cue phrases resolved against real word timings, pointer choreography,
highlight regions, host-frame attachment, clip-length matching — is expressed in terms of CSS
selectors and text on *your* pages. Porting to a new product means writing a new `scenes.mjs`
and a new narrative. It does not mean changing the engine.
