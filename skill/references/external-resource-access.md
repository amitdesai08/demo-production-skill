# Deciding access — whose credential captures the demo

Capturing a real, gated product or resource means **doing something against it under some
identity** — there is no scripted-login shortcut, and this skill has no standing access to
anything by default. So before writing a single capture step, decide **whose** credential the
capture will use, deliberately, rather than letting it default to whatever happens to be signed
in.

**All three mechanical steps below — verify, plan, create — are one script,
`reference-implementation/setup-demo-access.ps1` (wherever you copied `reference-implementation/`
into your project); nothing in this file needs to be typed out by hand as a one-off `az`
command.** The decisions
(which resource, interactive vs. SPN, which role) are still yours to make and, where noted, the
user's to approve — the script only performs the Azure calls once a decision is made. (This
script is Azure-specific; if the subject lives on a different cloud or has no cloud resource at
all, the same decision procedure still applies — just perform the verify/plan/create steps with
that platform's own CLI/API instead.)

**This file is about access — who's allowed to look.** Once that's settled, the actual
click-through/narrated-video capture is a separate concern, covered in
[`scene-schema.md`](scene-schema.md) and `reference-implementation/CONFIGURE.md`:
`capture.mjs` drives any URL your `scenes.mjs` names, using the interactive session you just
verified (or signed into) here — it never touches the SPN path below at all, since a real
browser click-through needs a human's own signed-in session, not an API credential.

## When this applies

Always, unless the subject has its own built-in, credential-free demo mode (a product you
control that ships a demo/sandbox mode is the one real exception). For anything else — your own
app behind real sign-in, a Foundry deployment, an ADF pipeline, any other gated resource — stop
before writing a single capture step and work out access first.

## Decision procedure — work through this in order, don't leave it to judgment mid-task

Each step either resolves itself from what's already been said, or names the **one specific
question** to ask instead of guessing. Never skip a step because the answer "seems obvious" —
that's exactly how a demo ends up depending on access nobody meant to grant.

**1. Which resource, exactly?**
Do you have the resource ID (or unambiguous name + resource group + subscription)? If yes,
continue. If no — **ask**: *"Which resource should this capture — the resource name, resource
group and subscription, or the exact resource ID?"* Don't search across subscriptions or guess
from a similar-sounding name; a wrong guess here means requesting access to, or acting on, the
wrong thing.

**2. One-off or repeatable?**
If the user's own request already implies this ("record this once for me" → one-off; "set this
up so the team can refresh it" / "run this nightly" → repeatable), decide from that directly —
do not ask a question whose answer was already given. If it's genuinely unstated, **ask**:
*"Will you run this capture yourself, once or occasionally, or does it need to run unattended or
be handed to someone else?"* If the user has no preference or doesn't answer, **default to a
one-off interactive run** — it is the reversible, lower-privilege choice, and an SPN is easy to
add later if it turns out to be needed. Never default to creating an SPN "to be safe."

**3. Interactive path → verify, then proceed without further prompting.**
Run:
```powershell
reference-implementation/setup-demo-access.ps1 -Verify -ResourceId <the resource ID from step 1>
```
If it reports success, continue — no need to ask permission to *look at* a resource the user
just asked you to demo. If it fails (wrong tenant, no role assignment, resource not visible from
the current session), **stop and ask** which account or subscription to use; never retry
blindly or prompt for a password/secret.

**4. SPN path → decide the role and scope automatically, but always confirm before creating.**
Creating an identity and assigning it a role is a real, mutating change to the user's tenant —
treat it the same as any other action that touches shared infrastructure:
   a. Pick the least-privilege role **yourself** — don't ask the user to know Azure RBAC. Use
      an RBAC-guidance skill if this workspace has one; otherwise use the starting points in
      [the role table below](#a-least-privilege-starting-point-when-no-rbac-skill-is-available)
      for the resource type, and state which role and why.
   b. Run the script in plan mode and show its output verbatim — don't paraphrase it:
      ```powershell
      reference-implementation/setup-demo-access.ps1 -Plan -ResourceId <resource ID> -Role "<role from 4a>"
      ```
      This prints the exact SPN name, role and scope without creating anything.
   c. **Ask for explicit confirmation of that plan.** This is the one step in this whole
      procedure that must never proceed silently, even when steps 1–3 were fully autonomous.
   d. Once approved, re-run the **identical command** with `-CreateSpn` in place of `-Plan` —
      same `-ResourceId` and `-Role`, so what gets created matches exactly what was approved:
      ```powershell
      reference-implementation/setup-demo-access.ps1 -CreateSpn -ResourceId <resource ID> -Role "<same role>"
      ```
      The script writes the credential straight to a git-ignored `.env.spn-demo-*` file (never
      to the console, never into any file this skill's pipeline reads narration or manifests
      from) and prints only the file path. Do not go around the script and print, log or relay
      the secret value yourself.

**5. Either path → record it in the disclaimer.**
No prompting needed here — just do it, per "Say so in the demo itself" below.

### A least-privilege starting point when no RBAC skill is available

Treat this table as a first guess to confirm against the resource's own RBAC docs, not a
substitute for checking — resource-specific roles change and narrower custom roles may exist.

| Resource type | Read-only / view a run | Trigger or modify |
|---|---|---|
| Azure AI Foundry project / deployment | **Cognitive Services User** (scoped to the project) | **Azure AI Developer** (scoped to the project) |
| Azure Data Factory pipeline | **Reader** + **Data Factory** built-in monitoring role (scoped to that Data Factory) | **Data Factory Contributor** (scoped to that Data Factory) |
| Azure AI Search | **Search Index Data Reader** | **Search Service Contributor** |
| Storage account / container the demo reads from | **Storage Blob Data Reader** | **Storage Blob Data Contributor** |
| Anything not listed here | Find the narrowest built-in role whose description matches the exact action the capture performs — never **Contributor** or **Owner** on a resource group or subscription for a demo. | |

## Two ways to get access, and when to use which

### 1. The user's own credentials, interactively — the fast, one-off path

Use whatever the user (or the agent acting on their behalf, in their own terminal/session)
already has: an `az login` session, a browser already signed into the Azure Portal / AI Foundry
portal / ADF Studio, or `DefaultAzureCredential` picking up that same signed-in context. This is
the right default when:

- it's a single capture run, or the user will personally re-run it later;
- the user is present and able to consent to actions taken under their own identity;
- nothing needs to run unattended or be handed to somebody else.

**Verify before you script anything.** Don't assume standing access — run
`reference-implementation/setup-demo-access.ps1 -Verify -ResourceId <resource ID>` and confirm
it reports the resource you intend to capture. If that check fails — wrong tenant, no role
assignment, resource in a subscription the current session can't see — **stop and ask** which
account or subscription to use rather than guessing, retrying blindly, or (never) prompting for
a password or secret.

### 2. A scoped, least-privilege service principal — the repeatable path

Provision a dedicated SPN when the capture needs to run **unattended** (a schedule, a CI
pipeline), needs to be **handed to someone else** (a teammate, a demo-refresh job) without
sharing the user's own credentials, or will be **re-run often enough** that interactive re-auth
every time is a real workflow cost.

- **Pick the narrowest built-in role, scoped to the resource, not the resource group or
  subscription.** If this workspace has RBAC-guidance tooling available, use it to choose the
  role — that is exactly the job it exists for. As a concrete starting point: a Foundry
  project/deployment typically needs a project-scoped **Azure AI Developer** or **Cognitive
  Services User** role, never subscription-level **Contributor**; an ADF pipeline typically
  needs **Data Factory Contributor** (to trigger runs) or a read-only monitoring role (to only
  capture run history), scoped to that one Data Factory resource. Confirm the actual minimal
  role against the resource's own RBAC documentation rather than assuming one of these examples
  is exactly right for your case.
- **Prefer workload identity federation over a client secret.** `setup-demo-access.ps1` always
  creates a client-secret SPN — it is the fallback that works everywhere without extra setup.
  If the capture runs somewhere that supports federated credentials instead (GitHub Actions, a
  managed-identity-capable host), prefer that and skip the script's secret path entirely; the
  script says so in its own output as a reminder, since federation setup is specific to where
  the capture runs and isn't something one script can generalize.
- **Never let the secret touch anywhere it could be committed.** The script already enforces
  this — it writes the credential straight to a git-ignored `.env.spn-demo-*` file and never
  prints it to the console. Don't go around that: never copy the secret into a scene manifest, a
  narrative doc, a commit, or a chat message yourself.
- **Name, tag and record it.** The script already names the SPN as a demo-capture identity
  (`spn-demo-<resource>-capture`) and tags it (`demo-capture`, `managed-by:demo-production-skill`)
  so it never reads as an unexplained SPN later — the remaining step is yours: note its
  existence — what it can reach, who created it, and when — in the track's narrative or runbook
  disclaimer (see below). An SPN nobody remembers creating is a standing security liability, not
  a convenience; plan for its removal or credential rotation when the track is retired or
  refreshed, the same way you'd plan to revoke any other access grant that's outlived its
  purpose.

## Say so in the demo itself

The existing walkthrough docs should already open with a spoken "before you start" disclaimer
(which seat to sign in as, what to say out loud). A track that demos an external resource
extends that same disclaimer with **whose credential the capture depends on** — the presenter's
own signed-in session, or a named demo SPN — so whoever delivers the demo later knows what it
depends on and isn't surprised by an expired secret or a revoked role assignment mid-session.

## Quick recap

The [decision procedure](#decision-procedure--work-through-this-in-order-dont-leave-it-to-judgment-mid-task)
above is the actual process — this is only the one-line-per-step version to glance back at:
resource identity → one-off or repeatable → verify (interactive) or plan-then-confirm (SPN) →
record the access path in the disclaimer → plan teardown/rotation while it's still fresh.
