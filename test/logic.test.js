'use strict';
/*
  Tests for the brain, run with plain Node — no VS Code needed:  node test/logic.test.js
  (or `npm test`). This is why logic.js has no `require('vscode')` in it: pure functions
  are the ones you can test in a second. Add a case here before you change a rule.
*/
const assert = require('assert');
const logic = require('../src/logic');

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('  ok  ' + name);
}

// a fake diagnostic shaped like VS Code's (severity 0 = Error, 1 = Warning)
const diag = (line, sev, message, col = 0) => ({
  severity: sev,
  message,
  range: { start: { line, character: col }, end: { line, character: col + 3 } },
});

test('toPerches keeps only errors and sorts them', () => {
  const perches = logic.toPerches([diag(5, 1, 'a warning'), diag(2, 0, 'boom'), diag(0, 0, 'first')]);
  assert.strictEqual(perches.length, 2);
  assert.strictEqual(perches[0].line, 0);
  assert.strictEqual(perches[1].line, 2);
});

test('toPerches caps the crowd at 12', () => {
  const many = Array.from({ length: 30 }, (_, i) => diag(i, 0, 'e' + i));
  assert.strictEqual(logic.toPerches(many).length, 12);
});

test('coachError recognises a few common cases', () => {
  assert.match(logic.coachError({ message: "name 'foo' is not defined" }), /before it exists|typo/i);
  assert.match(logic.coachError({ message: 'No module named pandas' }), /install|import/i);
  assert.ok(logic.coachError({ message: 'something weird' }).length > 0); // always says something
});

test('planScene coaches errors when there are any', () => {
  const scene = logic.planScene({ perches: logic.toPerches([diag(1, 0, 'boom'), diag(3, 0, 'bang')]), fileName: 'bot.py' });
  assert.strictEqual(scene.mood, 'concentrate');
  assert.strictEqual(scene.perches.length, 2);
  assert.match(scene.say, /2 things/);
  assert.ok(scene.perches[0].tip); // each perch carries a coaching tip
});

test('planScene shows the quest step when the code is clean', () => {
  const quest = { title: 'Q', steps: [{ title: 'one' }, { title: 'two' }] };
  const scene = logic.planScene({ perches: [], quest, stepIndex: 1 });
  assert.strictEqual(scene.mood, 'idle');
  assert.strictEqual(scene.stepNumber, 2);
  assert.strictEqual(scene.step.title, 'two');
});

test('planScene celebrates past the last step', () => {
  const quest = { title: 'Q', steps: [{ title: 'only' }] };
  const scene = logic.planScene({ perches: [], quest, stepIndex: 1 });
  assert.strictEqual(scene.mood, 'celebrate');
});

test('advance never runs off the end', () => {
  const quest = { title: 'Q', steps: [{ title: 'a' }, { title: 'b' }] };
  assert.strictEqual(logic.advance(0, quest), 1);
  assert.strictEqual(logic.advance(1, quest), 2);
  assert.strictEqual(logic.advance(2, quest), 2); // clamped
});

test('validateQuest catches broken quests', () => {
  assert.ok(logic.validateQuest(null));
  assert.ok(logic.validateQuest({ title: 'x', steps: [] }));
  assert.ok(logic.validateQuest({ title: 'x', steps: [{ what: 'no title' }] }));
  assert.strictEqual(logic.validateQuest({ title: 'x', steps: [{ title: 'ok' }] }), null);
});

console.log(`\n${passed} tests passed.`);
