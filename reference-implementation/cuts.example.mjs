// EXAMPLE cuts file — alternative edits of a walkthrough, assembled from screens already
// captured (no browser, no re-capture — see build-cut.mjs).
//
//   node build-cut.mjs runbook
//   node narrate.mjs      --manifest scenes-runbook.json --force
//   node build-player.mjs --manifest scenes-runbook.json --out runbook.html
//   node build-video.mjs  --manifest scenes-runbook.json --out runbook.mp4

export const CUTS = {
  // A denser "delivery runbook" cut: same screens as the main walkthrough, reused via the
  // `use:` reference below, but narrated for a presenter who needs the implementation detail
  // (real routes, config flags, file paths) rather than the audience-facing story.
  runbook: {
    title: 'Demo runbook',
    source: 'docs/DEMO-RUNBOOK.md', // wherever your project keeps the matching markdown script
    sources: ['scenes.json'], // which already-captured manifest(s) to pull frames from
    acts: [
      { n: 1, title: 'The pitch' },
      { n: 2, title: 'The core workflow' },
    ],
    scenes: [
      {
        use: '01-open', // must match a scene id already captured in one of `sources`
        act: 1,
        title: 'One tenant, one backend',
        // Omitting `say` reuses the original scene's narration verbatim. Provide one here
        // when the runbook needs a denser, more technical retelling of the same screen.
        say: `Thirty seconds on the shape of it, then straight into the workflow this exists
          to prove out.`,
      },
      { use: '02-core-workflow', act: 2, title: 'The workflow, in implementation terms' },
    ],
  },
};
