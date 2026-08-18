// The worked example: a full scenes.mjs for a small sample product ("Northwind Tasks") that
// layers Azure AI Foundry and Microsoft Fabric on top of a plain task tracker, captured
// against the tiny static server in ./app/. This is what produces the "demo-production-skill"
// gallery demo — proof the toolkit works end to end on a non-Deal-Room product, and a worked
// example of the kind of demo a Solutions Engineer or CSA builds to show a customer what
// Foundry, Fabric (or a similar service) can do inside their own product.
//
// Run it (from reference-implementation/):
//   node example/app/serve.mjs &                                  (or a separate terminal)
//   node capture.mjs      --scenes example/scenes.mjs --manifest example.json
//   node narrate.mjs      --manifest example.json
//   node build-player.mjs --manifest example.json --out example.html
//   node build-video.mjs  --manifest example.json --out example.mp4

export const BASE = process.env.DEMO_BASE_URL || 'http://localhost:4173';

export const TITLE = 'The demo-production-skill, seen producing a demo';
export const SUBTITLE = 'A narrated walkthrough of a small sample product built on Azure AI '
  + 'Foundry and Microsoft Fabric — the kind of demo a Solutions Engineer or CSA builds for a '
  + 'customer, captured, narrated, and assembled entirely by the reference pipeline in this repo.';

export const ACTS = [
  { n: 1, title: 'The sample product' },
  { n: 2, title: 'AI and analytics, built in' },
  { n: 3, title: 'Board and task detail' },
  { n: 4, title: 'Team view and close' },
];

export const SCENES = [
  {
    id: '01-dashboard',
    act: 1,
    title: 'Where it opens',
    steps: [{ goto: '/' }, { waitText: 'Dashboard' }, { scrollTop: 0 }],
    say: `This is Northwind Tasks, a small sample project tracker. It's built to show what
      this toolkit can capture: real screens, real interactions, and a couple of Microsoft
      services doing visible work inside the product. The dashboard opens with four numbers
      that matter most: what's open, what's due, what's done, and how fast the team's moving.`,
  },
  {
    id: '02-attention',
    act: 1,
    title: 'What needs attention',
    steps: [{ scrollTo: 'What needs attention' }],
    spotlight: 'text:What needs attention',
    say: `Right below that sits what needs attention today. Three items, each flagged for its
      own reason: overdue, blocked, or waiting on someone else, so it's easy to scan in a few
      seconds.`,
  },
  {
    id: '03-ai-briefing',
    act: 2,
    title: 'The Azure AI Foundry briefing',
    steps: [{ scrollTo: 'This week, from your agent' }],
    spotlight: 'text:This week, from your agent',
    say: `This panel is where Azure AI Foundry earns its keep. An agent reads the week's
      activity and writes the briefing itself: what's moving, what's stuck, and who to nudge.
      Nobody typed this paragraph. It's generated fresh, every week, from the same data
      sitting right there on the dashboard.`,
  },
  {
    id: '04-fabric-trend',
    act: 2,
    title: 'The Microsoft Fabric trend',
    steps: [{ scrollTo: 'Velocity trend' }],
    spotlight: 'text:Velocity trend',
    say: `Right next to it, Microsoft Fabric is doing a different job: turning five weeks of
      task history into a trend a manager can read at a glance. This week's the tallest bar
      the team's posted all quarter, and that's the kind of pattern Fabric's built to surface
      without anyone building a report by hand.`,
  },
  {
    id: '05-board',
    act: 3,
    title: 'The board',
    steps: [{ goto: '/board.html' }, { waitText: 'Board' }],
    say: `The board lays the same work out by stage instead of urgency. Four columns, from
      backlog through done, and every card shows who's got it and when it's due. This isn't
      drag-and-drop trickery for the camera. It's a real board, captured at rest.`,
  },
  {
    id: '06-task-detail',
    act: 3,
    title: 'Opening a card',
    steps: [{ clickText: 'Redesign onboarding flow' }, { waitText: 'Description' }],
    say: `Clicking a card opens its full detail: the description, who's assigned, and where
      things stand right now. This is a real page in the sample app, not a modal faked just
      for the screenshot.`,
  },
  {
    id: '07-copilot',
    act: 3,
    title: 'Ask Copilot, backed by Foundry',
    steps: [{ scrollTo: 'Ask Copilot' }],
    spotlight: 'text:Ask Copilot',
    say: `Scrolling down, there's a Copilot panel sitting right on the task, also backed by
      Azure AI Foundry. Ask it what's blocking the task, and it answers from the same
      checklist and comments you just saw, not a canned response. One checklist item even
      started life as a Copilot suggestion.`,
  },
  {
    id: '08-team',
    act: 4,
    title: 'The team view',
    steps: [{ goto: '/team.html' }, { waitText: 'Team' }],
    say: `The team view flips the same data around again: five people, their current
      workload, and how many tasks each one's carrying. Microsoft Fabric adds one more layer
      here too, a capacity forecast that flags who's about to tip over before a deadline
      makes it obvious.`,
  },
  {
    id: '09-close',
    act: 4,
    title: 'How this was made',
    steps: [{ wait: 500 }],
    say: `That's the shape of it: a plain product, two Microsoft services doing real work
      inside it, and a demo built the same way you'd build one for a customer running Foundry
      or Fabric. Every screenshot, every line of narration, and this player were produced
      automatically by the toolkit in this repo. Point it at your own product next.`,
  },
];

export const TEASER_SCENES = ['01-dashboard', '03-ai-briefing', '04-fabric-trend', '09-close'];
