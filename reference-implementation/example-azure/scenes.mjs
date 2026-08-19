// The Azure-portal example: a full scenes.mjs that captures REAL portal.azure.com screens of
// a real Azure AI Foundry resource being deployed and configured. This is the demo published
// to the "Demo Production Skill" gallery entry — it exists to show the toolkit's primary
// audience (Solutions Engineers and CSAs) what a demo of deploying/configuring an actual
// Azure service looks like when produced by this pipeline, unmodified.
//
// This is NOT a zero-setup example like ../example/ (Northwind Tasks) — it needs a real,
// already-created Azure AI Foundry resource and a real Azure sign-in. Azure AD's sign-in
// session cookie is session-scoped (by design, for security), so it never survives a browser
// process restart no matter what profile directory is used — it can only be established ONCE
// per browser process. Because of that (and because Azure Portal's blades render inside a
// cross-origin iframe the standard capture.mjs step vocabulary can't see into), this example
// is captured by its own dedicated driver, capture-signed-in.mjs, not by capture.mjs directly
// — scenes.mjs stays the single source of truth for content/narration/order either way. Set
// AZ_ACCOUNT_HINT to (part of) the email shown on the account tile you want selected —
// capture-signed-in.mjs only ever selects an existing, already-Windows-connected tile via a
// synthetic click; it never reads, types, or stores a password or MFA code.
//
//   node example-azure/capture-signed-in.mjs
//   node narrate.mjs      --manifest example-azure.json
//   node build-player.mjs --manifest example-azure.json --out example-azure.html
//   node build-video.mjs  --manifest example-azure.json --out example-azure.mp4

const RESOURCE_ID = process.env.AZ_RESOURCE_ID
  || '/subscriptions/REPLACE-ME/resourceGroups/REPLACE-ME/providers/Microsoft.CognitiveServices/accounts/REPLACE-ME';
const TENANT_DOMAIN = process.env.AZ_TENANT_DOMAIN || 'REPLACE-ME.onmicrosoft.com';

export const BASE = 'https://portal.azure.com';

export const TITLE = 'The demo-production-skill, deploying a real Azure service';
export const SUBTITLE = 'A narrated walkthrough of deploying and configuring a real Azure AI '
  + 'Foundry resource in the Azure portal — the kind of demo a Solutions Engineer or CSA '
  + 'builds for a customer, captured, narrated, and assembled entirely by the reference '
  + 'pipeline in this repo.';

export const ACTS = [
  { n: 1, title: 'Deploying' },
  { n: 2, title: 'Configuring' },
  { n: 3, title: 'Close' },
];

// Azure Portal blades render inside a cross-origin iframe (reactblade.portal.azure.net), so
// the generic clickText/waitText steps (which only see the top document) can't reach into
// blade content. This is a viewing tour of real, already-configured resources, not a scripted
// form-fill — every scene after sign-in is just a URL + a settle wait (see
// capture-signed-in.mjs, which turns `goto` into a same-document hash change after the first
// scene, so later blade switches never re-trigger Azure AD's sign-in check).

export const SCENES = [
  {
    id: '01-home',
    act: 1,
    title: 'Signed in, for real',
    steps: [
      { signIn: '/#home' },
      { wait: 6000 },
    ],
    say: `This is the Azure portal, and it's a real sign-in, not staged. Everything from here
      on lives in an actual Azure subscription: a real resource group, a real resource, real
      configuration. Deploying something new starts with a single click on "Create a
      resource," right from here.`,
  },
  {
    id: '02-overview',
    act: 1,
    title: 'The deployed resource',
    steps: [{ goto: `/#@${TENANT_DOMAIN}/resource${RESOURCE_ID}/overview` }, { wait: 12000 }],
    say: `A few minutes later, the resource exists. This is its real Overview blade: API kind
      AI Services, region Sweden Central, status Succeeded. It's deployed the exact same way
      it'd be for a customer's own environment.`,
  },
  {
    id: '03-tags',
    act: 2,
    title: 'Configuring governance',
    steps: [{ goto: `/#@${TENANT_DOMAIN}/resource${RESOURCE_ID}/tags` }, { wait: 10000 }],
    say: `Configuring it means more than standing it up. Tags are the simplest example: name
      and value pairs that drive cost allocation and ownership, the kind of governance a
      customer's platform team checks before anything ships to production.`,
  },
  {
    id: '04-access',
    act: 2,
    title: 'Configuring access control',
    steps: [{ goto: `/#@${TENANT_DOMAIN}/resource${RESOURCE_ID}/users` }, { wait: 10000 }],
    say: `Access control handles the other half: who's allowed to use the resource once it
      exists. This assignment grants exactly one role, scoped to exactly this resource, the
      same least-privilege pattern you'd set up for a customer's own team.`,
  },
  {
    id: '05-close',
    act: 3,
    title: 'How this was made',
    steps: [{ wait: 500 }],
    say: `That's deploying and configuring a real Azure service, captured the same way this
      toolkit captures any product: a real browser, real screens, narrated naturally. The
      resource group behind this walkthrough gets deleted right after, same as any throwaway
      demo environment should be.`,
  },
];

export const TEASER_SCENES = ['01-home', '02-overview', '04-access', '05-close'];
