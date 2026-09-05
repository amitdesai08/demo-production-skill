// The silence held after each scene's narration before the cut, and the beat after the cut
// before the next scene speaks. Shared so the video, the caption timings and any derived
// audio track use the same beats — if they drift apart, captions land against the wrong
// scene, and the error compounds with every scene.
//
// The lead-in is what stops one section running straight into the next: without it the cut
// and the next line of narration happen on the same frame, which reads as continuous speech
// over changing pictures rather than as separate points. Together these are the only
// "section" pauses in the piece — see lib/narration-names.mjs and narrate.mjs for why
// pauses are NOT added between sentences inside a scene.
export const HOLD_AFTER_NARRATION = Number(process.env.DEMO_HOLD_SECONDS || 1.4);
export const LEAD_IN_SILENCE = Number(process.env.DEMO_LEAD_SECONDS || 0.7);
