# Scene manifest schema and the generic step vocabulary

A scene manifest is a `scenes.mjs` (or `scenes-<name>.mjs`) ES module. Copy
`reference-implementation/scenes.example.mjs` to start one. It exports:

- `BASE` — the product's URL.
- `TITLE` / `SUBTITLE` / `DISCLAIMER` — shown on the interactive player's opening card.
- `ACTS` — an array of `{ n, title }`, purely for grouping.
- `SCENES` — the array that actually drives everything (see shape below).
- `CUSTOM_STEPS` (optional) — your product's own step verbs. See below.
- `setActor` (optional) — an auto-role-switch hook keyed off a scene's `actor` field.
- `TEASER_SCENES` (optional) — which scene ids make a good short teaser cut.

## Scene object shape

```js
{
  id: 'xx-00-kebab-case-id',      // unique across the manifest; used as the audio/screenshot filename
  act: 1,                          // must match an ACTS[].n
  title: 'One line, shown in the player nav',
  actor: 'admin',                  // OPTIONAL — triggers setActor before this scene's steps, if defined
  steps: [ /* array of step objects, run in order — see vocabulary below */ ],
  spotlight: 'text:Some Fuzzy Match',   // OPTIONAL — draws a highlight box, does not click
  click: 'text:Button Label',           // OPTIONAL — draws a highlight box on something already clicked by a step
  say: `Multi-line narration prose. No presenter-instructions. Natural third-person
    voice describing the product, not the act of demoing it.`,
}
```

`say` gets whitespace-collapsed automatically; write it wrapped across multiple lines for your
own readability.

## The generic step vocabulary (built into the engine)

The capture engine (`capture.mjs`) ships only these steps. It throws `unknown step` for
anything else — add product-specific verbs as `CUSTOM_STEPS` instead (see below), never by
editing the engine:

| Step | Argument | What it does |
|---|---|---|
| `goto` | a path, e.g. `'/dashboard'` | Navigates to `${BASE}${path}` |
| `wait` | milliseconds | Plain sleep |
| `waitText` | a string | Waits until `document.body.innerText` contains it |
| `scrollTop` | a number (usually `0`) | Scrolls the page to that offset |
| `scrollTo` | a string | Waits for an element containing that text to exist, then scrolls it into view |
| `clickText` | a string | Waits for a clickable element (button/a/[role=button]/[role=tab]/select/input) matching that text, then clicks it |
| `click` | a CSS selector | Clicks a `document.querySelector` match directly |
| `type` | `['selector', 'text']` | Sets a text input/textarea's value via its native setter and dispatches an `input` event |
| `press` | a key name, e.g. `'Enter'` | Dispatches a keydown on the currently focused element |
| `dismiss` | text a banner/toast starts with | Closes it via its own close button, if one matching that text is present — safe to call unconditionally |

## Extending with custom steps — the pattern that keeps the engine generic

Your product almost certainly has domain concepts the engine has no business knowing about:
switching between user roles, opening a specific record, dismissing a product-specific modal
that needs more than a text match. Add these in your **own** scenes file, not the shared engine:

```js
export const CUSTOM_STEPS = {
  async switchRole(session, roleId, state) {
    await session.eval(`/* your product's role-switcher DOM logic, using roleId */`);
    state.role = roleId; // stash whatever your own steps need to read back later
  },
  async openRecord(session, name, state) {
    await session.eval(`/* find and open the record matching name */`);
    state.lastRecordUrl = await session.eval('location.pathname'); // for a later scene to reuse
  },
};
```

Use a custom step in a scene exactly like a built-in one: `steps: [{ switchRole: 'admin' }]`.

The `state` object is shared and mutated across the **whole capture run** (every scene, every
seat/role switch) — this is how one scene can set something up (open a record it has access
to) and a later scene, after switching to a different role, can reference it (try to open that
same URL directly and show the access boundary).

If your product has a "switch role, then act" pattern, wire it into the `actor` field/
`setActor` hook (see `scenes.example.mjs`) so scenes read naturally (`actor: 'admin'`) instead
of every scene needing an explicit `switchRole` step — the engine calls `setActor` automatically
before a scene's own steps run whenever `scene.actor` differs from the currently active one.

## Verify the real on-screen text before writing a `scrollTo`/`spotlight` spec

Text matching is a case-insensitive **substring** match against the actual rendered DOM text,
but it needs exact word adjacency — a heading that reads "What needs your attention" is not
matched by a spec written as `'needs attention'`. Before writing any `scrollTo`, `spotlight`, or
`clickText` spec:

1. Check the actual frontend source for the literal heading/button text, not a paraphrase from
   a design doc or spec.
2. Check whether the element is conditionally rendered — some UI only shows once matching data
   already exists. If what you want to show depends on data that isn't guaranteed to be present
   in your demo environment, either seed it first or retarget the scene at something that's
   always rendered.
3. If your demo environment might be running an older build than your source repo, verify the
   feature is actually live there before writing a scene that depends on it.

## `spotlight`/`click` only draw — they don't act

Both fields are purely for the generated player's highlight overlay. If you need to actually
interact with the element, that has to be a step in `steps`, not just the `spotlight`/`click`
field.
