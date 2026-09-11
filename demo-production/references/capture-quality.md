# Capture quality — real resolution, not whatever the browser happened to be

## The problem this fixes

A browser embedded inside an editor or IDE (VS Code's built-in Simple Browser is the common
case) typically renders into a small, fixed panel — around 918×574 in VS Code's case — and does
not repaint larger no matter what CSS viewport size or zoom you ask for. Capturing screenshots
from a browser like that produces small, soft, unmistakably "screenshotted from a dev tool"
images, and no amount of downstream editing fixes it — the pixels you need were never rendered.

**The fix is to never capture from an embedded/IDE browser at all.** `lib/cdp.mjs` launches a
real, separate, headless Chromium/Edge process and talks to it directly over the Chrome
DevTools Protocol, which puts full control of the render surface in your hands:

```js
// from lib/cdp.mjs's launch()
await s.send('Emulation.setDeviceMetricsOverride', {
  width, height, deviceScaleFactor: scale, mobile: false,
});
```

A headless browser paints exactly what it's told to, at exactly the resolution it's told to —
there's no host window, no OS chrome, no DPI setting to fight. `deviceScaleFactor` is the
second half of this: setting it to `2` (the calibrated default) renders everything at **twice**
the logical pixel density, the same effect as a Retina/HiDPI display, before the screenshot is
taken. A `1440×900` logical viewport at `scale: 2` produces a `2880×1800` physical-pixel PNG —
sharp on any display it's later shown on, including projected onto a large screen in a room.

Screenshots are taken via `Page.captureScreenshot` with `format: 'png'` — lossless, not a
compressed JPEG — so no re-compression artefacts stack up between capture and the final MP4.

## The controls

Set once, in your environment, before running `capture.mjs`:

| Env var | Default | What it controls |
|---|---|---|
| `DEMO_WIDTH` | `1440` | Logical viewport width |
| `DEMO_HEIGHT` | `900` | Logical viewport height |
| `DEMO_SCALE` | `2` | Device pixel ratio — this is the resolution multiplier |

The defaults produce a 2880×1800 physical capture, which reads crisp in the interactive player,
in the rendered MP4, and projected in a live room. Don't lower `DEMO_SCALE` to `1` to save disk
space or render time unless you have a specific reason — the file-size difference is modest and
the visible quality difference, especially once the MP4 is scaled/compressed again by
`build-video.mjs`, is not.

## How to verify a capture actually came out at the resolution you expect

Don't just eyeball the screenshot in a small preview pane — check the actual pixel dimensions
of a captured PNG after a run:

```powershell
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile("build/shots/<some-scene-id>.png")
"$($img.Width) x $($img.Height)"
$img.Dispose()
```

With the defaults, this should read `2880 x 1800`. If it reads something smaller (or matches an
IDE's embedded browser panel size, like `918 x 574`), something in your setup is overriding
`DEMO_WIDTH`/`DEMO_HEIGHT`/`DEMO_SCALE`, or a step in your capture is somehow re-routing through
a different, embedded browser instance rather than the one `lib/cdp.mjs` launched — check that
`DEMO_BROWSER`, if you've set it, points at a real Edge/Chrome executable and not a wrapper.

## `DEMO_HEADED=1` doesn't change capture resolution, only visibility

Setting `DEMO_HEADED=1` opens a visible browser window so you can watch a capture run happen,
which is useful for debugging a broken scene. It does **not** change the resolution the
screenshot is taken at — `Emulation.setDeviceMetricsOverride` still governs that regardless of
whether the window itself is visible on your screen or not. Don't confuse "I can see the
browser window and it looks small on my monitor" with "the capture is low-resolution" — check
the actual PNG dimensions as above if you're ever unsure.
