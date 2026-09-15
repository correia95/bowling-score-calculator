import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addRoll,
  computeGame,
  decodeRolls,
  encodeRolls,
  frameMarks,
  isGameComplete,
  isValidRoll,
  maxPinsForNextRoll,
  shareText,
} from './bowling.ts';

test('a perfect game (12 strikes) scores 300', () => {
  const rolls = Array(12).fill(10);
  const g = computeGame(rolls);
  assert.equal(g.complete, true);
  assert.equal(g.total, 300);
  assert.equal(g.frames.length, 10);
  assert.ok(g.frames.every((f) => f.score === 30));
  assert.equal(isGameComplete(rolls), true);
  assert.equal(maxPinsForNextRoll(rolls), 0);
});

test('a gutter game (20 zeros) scores 0', () => {
  const rolls = Array(20).fill(0);
  const g = computeGame(rolls);
  assert.equal(g.complete, true);
  assert.equal(g.total, 0);
});

test('all 5-5 spares with a final 5 bonus ball scores 150', () => {
  const rolls = Array(21).fill(5);
  const g = computeGame(rolls);
  assert.equal(g.complete, true);
  assert.equal(g.total, 150);
  assert.ok(g.frames.slice(0, 9).every((f) => f.isSpare && f.score === 15));
});

test('the classic reference game scores 133', () => {
  // 1,4 4,5 6,4 5,5 10 0,1 7,3 6,4 10 2,8,6
  const rolls = [1, 4, 4, 5, 6, 4, 5, 5, 10, 0, 1, 7, 3, 6, 4, 10, 2, 8, 6];
  const g = computeGame(rolls);
  assert.equal(g.complete, true);
  assert.equal(g.total, 133);
  const scores = g.frames.map((f) => f.score);
  assert.deepEqual(scores, [5, 9, 15, 20, 11, 1, 16, 20, 20, 16]);
});

test('an open frame followed by a strike is scored correctly once resolved', () => {
  const rolls = [3, 4, 10, 2, 3];
  const g = computeGame(rolls);
  // frame1: 3+4=7; frame2: strike -> 10+2+3=15; frame3: 2,3 (open, not a spare) = 5
  assert.equal(g.frames[0].score, 7);
  assert.equal(g.frames[1].score, 15);
  assert.equal(g.frames[2].score, 5);
  assert.equal(g.runningTotal[2], 27); // game isn't finished (only 3 of 10 frames), so .total stays null
  assert.equal(g.total, null);
});

test('scoring is live: pending frames show null until their bonus rolls land', () => {
  const g1 = computeGame([10]); // just a strike, nothing after it yet
  assert.equal(g1.frames[0].score, null);
  assert.equal(g1.runningTotal[0], null);
  assert.equal(g1.total, null);
  assert.equal(g1.complete, false);

  const g2 = computeGame([10, 4]);
  assert.equal(g2.frames[0].score, null); // still needs one more bonus roll
  assert.equal(g2.frames.length, 2); // frame 2 is already under way (live scoring)
  assert.deepEqual(g2.frames[1].rolls, [4]);
  assert.equal(g2.frames[1].score, null);

  const g3 = computeGame([10, 4, 3]);
  assert.equal(g3.frames[0].score, 17); // 10 + 4 + 3
  assert.equal(g3.frames.length, 2);
  assert.deepEqual(g3.frames[1].rolls, [4, 3]);
  assert.equal(g3.frames[1].score, 7); // open frame, not a spare (4+3=7)
});

test('frame 2 starts once frame 1 (a strike) is fully consumed', () => {
  const g = computeGame([10, 5]);
  assert.equal(g.frames.length, 2);
  assert.equal(g.frames[0].score, null); // frame 1 still waiting on one more bonus ball
  assert.deepEqual(g.frames[1].rolls, [5]); // frame 2's first ball, frame in progress
  assert.equal(g.frames[1].score, null);
});

test('10th frame: strike then two fresh-rack bonus balls, including a bonus strike', () => {
  const nineOpen = Array(18).fill(0); // 9 complete gutter-ball frames
  const rolls = nineOpen.concat([10, 10, 10]);
  const g = computeGame(rolls);
  assert.equal(g.complete, true);
  assert.deepEqual(g.frames[9].rolls, [10, 10, 10]);
  assert.equal(g.frames[9].score, 30);
  assert.equal(g.total, 30);
});

test('maxPinsForNextRoll enforces the pin-count rules through a whole game', () => {
  let rolls = [];
  assert.equal(maxPinsForNextRoll(rolls), 10);
  rolls = addRoll(rolls, 6);
  assert.equal(maxPinsForNextRoll(rolls), 4); // only 4 pins left standing
  assert.equal(isValidRoll(rolls, 5), false);
  rolls = addRoll(rolls, 4); // spare
  assert.equal(maxPinsForNextRoll(rolls), 10); // frame 2, fresh rack
});

test('10th frame pin-count rules: strike opens two independent fresh-rack bonus balls', () => {
  const nineOpen = Array(18).fill(0); // 9 complete gutter-ball frames
  let rolls = nineOpen.concat([10]); // strike to open the 10th
  assert.equal(maxPinsForNextRoll(rolls), 10); // bonus ball 1, fresh
  rolls = rolls.concat([7]);
  assert.equal(maxPinsForNextRoll(rolls), 3); // bonus ball 2 continues that same rack (7 down, 3 left)
  rolls = rolls.concat([3]);
  assert.equal(maxPinsForNextRoll(rolls), 0); // game over
  assert.equal(isGameComplete(rolls), true);
});

test('10th frame: two strikes in the bonus balls both get a fresh rack', () => {
  const nineOpen = Array(18).fill(0); // 9 complete gutter-ball frames
  let rolls = nineOpen.concat([10, 10]);
  assert.equal(maxPinsForNextRoll(rolls), 10); // second bonus ball, fresh rack because first bonus was a strike
  rolls = rolls.concat([10]);
  assert.equal(isGameComplete(rolls), true);
  const g = computeGame(rolls);
  assert.equal(g.frames[9].score, 30);
});

test('10th frame: a spare grants one fresh-rack bonus ball, an open frame grants none', () => {
  const nineOpen = Array(18).fill(0); // 9 complete gutter-ball frames
  let spareRolls = nineOpen.concat([6, 4]); // spare
  assert.equal(maxPinsForNextRoll(spareRolls), 10);
  spareRolls = spareRolls.concat([5]);
  assert.equal(isGameComplete(spareRolls), true);

  const openRolls = nineOpen.concat([6, 3]); // open, no bonus
  assert.equal(isGameComplete(openRolls), true);
  assert.equal(maxPinsForNextRoll(openRolls), 0);
});

test('addRoll silently ignores an illegal roll', () => {
  let rolls = [6];
  const before = rolls;
  rolls = addRoll(rolls, 5); // only 4 pins left standing
  assert.equal(rolls, before); // unchanged
  rolls = addRoll(rolls, 4);
  assert.deepEqual(rolls, [6, 4]);
});

test('encodeRolls / decodeRolls round-trip and reject malformed or illegal sequences', () => {
  const rolls = [1, 4, 4, 5, 6, 4, 5, 5, 10, 0, 1, 7, 3, 6, 4, 10, 2, 8, 6];
  assert.deepEqual(decodeRolls(encodeRolls(rolls)), rolls);
  assert.deepEqual(decodeRolls(''), []);
  assert.deepEqual(decodeRolls('abc'), []);
  assert.deepEqual(decodeRolls('11'), []); // out of range
  // an impossible sequence (7 then 7 in the same frame) stops at the illegal roll
  assert.deepEqual(decodeRolls('7.7'), [7]);
});

test('frameMarks: frames 1-9 put the strike mark in the second box', () => {
  const strikeFrame = computeGame([10, 3, 4]).frames[0];
  assert.deepEqual(frameMarks(strikeFrame), ['', 'X']);
  const spareFrame = computeGame([6, 4, 5]).frames[0];
  assert.deepEqual(frameMarks(spareFrame), ['6', '/']);
  const openFrame = computeGame([6, 3]).frames[0];
  assert.deepEqual(frameMarks(openFrame), ['6', '3']);
});

test('frameMarks: 10th-frame balls after a strike or spare never falsely mark a spare against the wrong ball', () => {
  // strike, then 4 and 6 — 4+6=10 but that's ball2+ball3 on a FRESH rack after the strike, a real spare
  assert.deepEqual(frameMarks(computeGame(Array(18).fill(0).concat([10, 4, 6])).frames[9]), ['X', '4', '/']);
  // strike, then two strikes — every ball is a fresh-rack strike
  assert.deepEqual(frameMarks(computeGame(Array(18).fill(0).concat([10, 10, 10])).frames[9]), ['X', 'X', 'X']);
  // spare (6,4), then a bonus ball of 6 — must NOT read as a spare against ball 2 (4+6=10 coincidentally)
  assert.deepEqual(frameMarks(computeGame(Array(18).fill(0).concat([6, 4, 6])).frames[9]), ['6', '/', '6']);
  // strike, then ball2=4 (not a strike), ball3=3 continues that same rack without completing a spare
  assert.deepEqual(frameMarks(computeGame(Array(18).fill(0).concat([10, 4, 3])).frames[9]), ['X', '4', '3']);
});

test('shareText renders scorecard marks and the final score', () => {
  const rolls = [10, 7, 3, 9, 0];
  const text = shareText(rolls);
  assert.match(text, /X 7\/ 9-/);
  assert.match(text, /in progress/);

  const perfect = shareText(Array(12).fill(10));
  assert.match(perfect, /= 300/);
});
