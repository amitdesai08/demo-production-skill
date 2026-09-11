# Capturing an app hosted inside another app

## Contents
- When you need this
- The app is in a different process, and invisible by default
- The split that makes this work
- Three coordinate spaces, and the rule for each
- Measuring the offset after dismissing host chrome, and per scene
- Host state is long-lived: set it, never assume it
- Navigation must stay inside the frame
- Opening the tab automatically
- Sizing the window to the video's resolution
- Aims measured standalone do not transfer

## When you need this

The product is normally *used* inside a host application — a chat/collaboration tab, an intranet
page, a portal, an embedded iframe — and the demo is more honest filmed there than standalone.
The host is part of the story: the navigation around it, the tab strip, the identity chrome. All
of that is evidence the product lives where the work happens.

The cost is real: the app renders in a smaller pane, and everything about coordinates gets
harder. Decide deliberately.

## The app is in a different process, and it is invisible by default

If the app is cross-origin to the host — it almost always is — Chrome puts it in its own
process. Consequences that look like "the tab isn't open":

- it does **not** appear in `Page.getFrameTree`
- it fires no `Runtime.executionContextCreated`
- `Runtime.evaluate` on the page target cannot see it

A first probe reported "no frame carries the app's markers" for exactly this reason, and the
obvious conclusion — that the tab wasn't rendered — was wrong.

**Reaching it:**

```js
await send('Target.setAutoAttach', {
  autoAttach: true, waitForDebuggerOnStart: false, flatten: true,
});
// then, per attached sessionId:
await send('Runtime.enable', {}, sessionId);
await send('Runtime.evaluate', { expression, returnByValue: true }, sessionId);
```

Arm this **before** navigating, or the frame is created before anyone is listening. Auto-attach
also yields service workers and web workers, which throw `ReferenceError: document is not
defined` — filter to `targetInfo.type === 'iframe'`.

Identify the app frame by **markers its own document carries**, not by URL, and poll: the frame
exists before the app inside it has rendered anything recognisable.

## The split that makes this work

Rather than rewriting every DOM call, give the CDP wrapper a **default session**:

- **script** → the app's frame
- **input and screencast** → the top page

That split is the whole design. The camera films the entire host window — chrome, rail, tabs —
while the script drives the app inside it.

## Three coordinate spaces, and the rule for each

This is where the silent errors live.

| What | Space | Why |
|---|---|---|
| The app's own rects | app frame | that's what its DOM reports |
| `Input.dispatchMouseEvent` | **page** | input is dispatched at the page level |
| Pointer track, focus rects, spotlight and click rects written to the manifest | **page** | the picture is the whole window |

So: aim the choreography in app space, add the offset when **dispatching**, and add it again
when **writing out**. Do not offset before the choreography reads a rect — that double-counts.

A track written in app space but declared against a 1920×1080 frame draws the cursor hundreds
of pixels away, in the host's chrome. Verify with one line: every pointer coordinate must fall
inside the app pane's bounds.

## Measure the offset AFTER dismissing host chrome, and again per scene

The host's own banners ("turn on notifications", "get the app") push the app frame down. Measure
the offset first and dismiss afterwards and the offset is stale by the height of a bar that is
no longer there — in one case 36px, applied to **every pointer and highlight in all 30 scenes**.

It did not look obviously wrong: 36px inside a 669px-tall highlight is invisible. It surfaced
only because two runs reported different pane origins for the same window and tab. **Two runs
disagreeing about geometry is a bug, not noise.**

Two habits follow:

1. **Dismiss, settle, then measure.**
2. **Re-measure per scene**, immediately before anything moves a pointer, and log when it
   changes. Trusting a single startup measurement is what made the bug possible; removing the
   assumption matters more than fixing the instance.

When dismissing chrome, scope the search to the banner you recognise and **dedupe the buttons
with a Set** — ancestors nest, so one banner matched eight times. A broad "click anything that
says close" sweep can close the thing you are demonstrating.

## Host state is long-lived: set it, never assume it

The host tab survives between runs and keeps whatever state the last one left — including the
signed-in view, the selected role, or an applied filter. A capture that initialises its own idea
of that state and only changes it when a scene differs will run the whole first act under the
wrong one **and report `ok` for every scene**. In one measured case an entire pass ran under the
wrong role; the only symptom was a single later scene failing because a panel that only exists
for the intended role never appeared.

Apply the opening state explicitly at startup.

## Navigation must stay inside the frame

A host that routes on the client has no URL for "this channel, this tab". Two consequences:

- **You cannot deep-link.** The working model is: launch headed on a persistent profile, get to
  the tab, then drive.
- **Any scene step that navigates must do so inside the app frame** — set `location.hash`, do
  not call `Page.navigate`. A page-level navigation takes the *host* away and silently destroys
  the recording.

## Open the tab automatically

Waiting for a human to click before every run makes iteration miserable. There is no URL, but
there is the same UI a person clicks: the channel in the rail, then the tab. Drive it in the top
document, and **match on exact text**. Loose matching is a trap: if one tab is named as a prefix
of another (`"Reports"` and `"Reports Archive"`), a substring match opens the wrong one and
looks like it worked.

Keep the manual prompt as a fallback: the host's markup is not yours and will change.

## Size the window so the page renders at the video's resolution

Headless takes a viewport instruction. A headed window does not — the window is the frame, and
overriding device metrics renders the page at a size the window does not have.

Measure what the chrome costs instead: fill the screen once, compare window size to viewport,
then set the window so the *page* lands on the target and correct iteratively. Keep the aspect
ratio and scale down only if the screen cannot fit it — the shape is what the video needs, and
a window of the wrong shape gets cropped, anchored at the top, so it is the app pane that loses
its bottom.

## Aims measured standalone do not transfer

The app pane inside a host is a different size from the standalone app, so any spotlight
rectangles measured against the standalone product frame the wrong things.

The fix is **not** to re-measure them. Check whether each scene's spotlight *selectors* line up
one-to-one with its cues — if they do, resolve the selectors live in the app frame at capture
time and keep only the cue *timings* from the plan. Timings come from the narration and are
layout-independent. That deletes a re-derivation step rather than adding one.
