// The worked example: a full scenes.mjs for a small, fictional sample product ("Northwind
// Tasks"), captured against the tiny static server in ./app/. This is what produces the
// "demo-production-skill" gallery demo — proof the toolkit works on a real, non-Deal-Room
// product, end to end: capture, narrate, build-player, build-video, all unmodified.
//
// Run it (from reference-implementation/):
//   node example/app/serve.mjs &                                  (or a separate terminal)
//   node capture.mjs      --scenes example/scenes.mjs --manifest example.json
//   node narrate.mjs      --manifest example.json
//   node build-player.mjs --manifest example.json --out example.html
//   node build-video.mjs  --manifest example.json --out example.mp4

export const BASE = process.env.DEMO_BASE_URL || 'http://localhost:4173';

export const TITLE = 'The demo-production-skill, seen producing a demo';
export const SUBTITLE = 'A narrated walkthrough of a small sample product, captured, narrated, '
  + 'and assembled entirely by the unmodified reference pipeline in this repo.';
export const DISCLAIMER = 'Northwind Tasks is a fictional sample app built only to demonstrate '
  + 'this toolkit — it is not a real product.';

export const ACTS = [
  { n: 1, title: 'The sample product' },
  { n: 2, title: 'Board and task detail' },
  { n: 3, title: 'Team view and close' },
];

export const SCENES = [
  {
    id: '01-dashboard',
    act: 1,
    title: 'Where it opens',
    steps: [{ goto: '/' }, { waitText: 'Dashboard' }, { scrollTop: 0 }],
    say: `This is Northwind Tasks, a small sample project tracker. It's not a real product; it
      exists only to show what this toolkit can build for any product, screen by screen. The
      dashboard opens with four numbers that matter most: what's open, what's due, what's
      done, and how fast the team's moving.`,
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
    id: '03-board',
    act: 2,
    title: 'The board',
    steps: [{ goto: '/board.html' }, { waitText: 'Board' }],
    say: `The board lays the same work out by stage instead of urgency. Four columns, from
      backlog through done, and every card shows who's got it and when it's due. This isn't
      drag-and-drop trickery for the camera. It's a real board, captured at rest.`,
  },
  {
    id: '04-task-detail',
    act: 2,
    title: 'Opening a card',
    steps: [{ clickText: 'Redesign onboarding flow' }, { waitText: 'Description' }],
    say: `Clicking a card opens its full detail: the description, who's assigned, and where
      things stand right now. This is a real page in the sample app, not a modal faked just
      for the screenshot. It's just another URL.`,
  },
  {
    id: '05-checklist',
    act: 2,
    title: 'Checklist and comments',
    steps: [{ scrollTo: 'Comments' }],
    say: `Scrolling down gets you the checklist, then the conversation underneath it. A few
      steps are already checked off, a couple of teammates have weighed in, and that's the
      whole shape of a task page. Nothing's hidden behind a click that wasn't captured.`,
  },
  {
    id: '06-team',
    act: 3,
    title: 'The team view',
    steps: [{ goto: '/team.html' }, { waitText: 'Team' }],
    say: `The team view flips the same data around again. Five people, their current workload,
      and how many tasks each one's carrying. Same underlying facts, just a different question
      answered. It's the same product, seen from a different seat.`,
  },
  {
    id: '07-close',
    act: 3,
    title: 'How this was made',
    steps: [{ wait: 500 }],
    say: `Northwind Tasks isn't real, but everything you just watched was produced the same
      way a real product's demo would be. A real page, loaded in a real browser, captured at
      full resolution, narrated in a natural voice, and assembled into this player
      automatically. That's the whole point: point it at your own product next.`,
  },
];

export const TEASER_SCENES = ['01-dashboard', '03-board', '07-close'];
