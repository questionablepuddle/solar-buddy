'use strict';
/**
 * The brain, with no VS Code in it.
 *
 * Everything here is plain functions on plain data: errors in, a plan out. Keeping it
 * separate from extension.js means two good things — you can read it without knowing the
 * VS Code API, and you can test it in a plain Node script (see test/logic.test.js). As a
 * rule, push logic into files like this and keep the VS-Code-specific file thin.
 */

/** A VS Code diagnostic is a rich object; we only want a few fields. Reduce it to a "perch":
 *  a spot the buddy can stand on. (severity 0 = Error in the VS Code enum.) */
function toPerches(diagnostics, { errorsOnly = true } = {}) {
  return diagnostics
    .filter((d) => (errorsOnly ? d.severity === 0 : d.severity <= 1))
    .map((d) => ({
      line: d.range.start.line, // 0-based line number
      column: d.range.start.character,
      // the error's end column, but only if it's on the same line (so we can underline the token)
      endColumn: d.range.end.line === d.range.start.line ? d.range.end.character : d.range.start.character + 1,
      message: String(d.message).split('\n')[0].slice(0, 200),
      source: d.source || '',
    }))
    .sort((a, b) => a.line - b.line || a.column - b.column)
    .slice(0, 12); // more than a dozen buddies is a mob, not a help
}

/** A friendly one-liner about an error. We don't try to be a linter; we nudge toward reading it. */
function coachError(perch) {
  const m = perch.message.toLowerCase();
  const tips = [
    [/is not defined|cannot find name|undefined name|no name/, "Something's being used before it exists — a typo in the name, or a missing import up top?"],
    [/unexpected|invalid syntax|expected|parsing/, 'A syntax slip — usually a missing bracket, comma, or colon just before here.'],
    [/not callable|is not a function/, "You're calling something that isn't a function — check what that name actually holds."],
    [/unused|never used|assigned but/, "Harmless, but tidy: this is declared and never used. Delete it or start using it."],
    [/no module named|cannot find module|module not found/, 'A library isn’t installed or the name is off. Install it, or fix the import path.'],
    [/indentation|indent/, 'Indentation mismatch — mixing tabs and spaces does this a lot.'],
    [/type|expected .* but/, 'A type mismatch — the value here isn’t the shape this code expects.'],
  ];
  for (const [re, tip] of tips) if (re.test(m)) return tip;
  return 'Read it slowly, left to right — the fix is usually a few characters before where it points.';
}

/**
 * Decide what the buddy should do right now, from the world's current state.
 * Returns a "scene" the stage knows how to play. This is the one function that turns
 * "what is true" into "what to show", and keeping it pure makes the behaviour easy to reason about.
 */
function planScene({ perches = [], fileName = '', quest = null, stepIndex = 0, lines = {} }) {
  if (perches.length > 0) {
    return {
      mood: 'concentrate',
      fileName,
      perches: perches.map((p) => ({ ...p, tip: coachError(p), text: lines[p.line] || '' })),
      say: perches.length === 1
        ? `One thing to fix in ${fileName || 'this file'}. I'm on it.`
        : `${perches.length} things to fix — I'll split up and take one each.`,
    };
  }
  const step = quest && quest.steps[Math.min(stepIndex, quest.steps.length - 1)];
  if (step) {
    const done = quest.steps.length > 0 ? stepIndex / quest.steps.length : 0;
    return {
      mood: stepIndex >= quest.steps.length ? 'celebrate' : 'idle',
      quest: quest.title,
      stepNumber: Math.min(stepIndex + 1, quest.steps.length),
      stepCount: quest.steps.length,
      progress: done,
      step,
      say: step.say || step.title,
    };
  }
  return { mood: 'idle', say: 'No errors. Want to pick a quest? I’ll walk you through a project.' };
}

/** Move to the next quest step, clamped so it never runs past the end. */
function advance(stepIndex, quest) {
  const max = quest ? quest.steps.length : 0;
  return Math.min(stepIndex + 1, max);
}

/** Validate a quest file so a typo in your own quest gives a clear message, not a crash. */
function validateQuest(data) {
  if (!data || typeof data !== 'object') return 'quest is not an object';
  if (!data.title) return 'quest needs a "title"';
  if (!Array.isArray(data.steps) || data.steps.length === 0) return 'quest needs a non-empty "steps" array';
  for (let i = 0; i < data.steps.length; i++) {
    if (!data.steps[i] || !data.steps[i].title) return `step ${i + 1} needs a "title"`;
  }
  return null; // null means "all good"
}

module.exports = { toPerches, coachError, planScene, advance, validateQuest };
