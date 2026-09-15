// Ten-pin bowling scoring, from a flat list of rolls (pins knocked down per
// ball) in the order they were bowled.
//
// Frames 1-9: a strike (all 10 on the first ball) scores 10 plus the next two
// balls; a spare (two balls that clear the rack) scores 10 plus the next one
// ball; an open frame scores the two balls bowled. Frame 10 has no
// "next roll" to borrow from — instead it awards its own bonus ball(s)
// directly inside the frame: one extra ball after a spare, two after a
// strike, each bowled against a freshly-racked 10 pins.

export const FRAME_COUNT = 10;

export interface Frame {
  index: number; // 0-9
  rolls: number[];
  isStrike: boolean;
  isSpare: boolean;
  /** Null while the frame is still waiting on bonus rolls (or isn't finished). */
  score: number | null;
}

export interface Game {
  frames: Frame[];
  /** Cumulative score through each frame; null until that frame (and any it depends on) is fully resolved. */
  runningTotal: (number | null)[];
  total: number | null;
  complete: boolean;
}

/**
 * How many pins are standing for the very next roll. 10 = a fresh rack,
 * 0 = the game is already finished (no more rolls are legal).
 */
export function maxPinsForNextRoll(rolls: number[]): number {
  let idx = 0;
  for (let frame = 0; frame < FRAME_COUNT - 1; frame++) {
    if (idx >= rolls.length) return 10; // ball 1 of a fresh frame
    const b1 = rolls[idx];
    if (b1 === 10) {
      idx += 1;
      continue; // strike — frame over in one ball
    }
    if (idx + 1 >= rolls.length) return 10 - b1; // ball 2, same rack
    idx += 2;
  }

  // 10th frame
  if (idx >= rolls.length) return 10; // ball 1
  const b1 = rolls[idx];
  if (b1 === 10) {
    if (idx + 1 >= rolls.length) return 10; // ball 2, fresh rack after a strike
    const b2 = rolls[idx + 1];
    if (idx + 2 >= rolls.length) return b2 === 10 ? 10 : 10 - b2; // ball 3
    return 0; // all three balls bowled — game over
  }
  if (idx + 1 >= rolls.length) return 10 - b1; // ball 2, same rack
  const b2 = rolls[idx + 1];
  if (b1 + b2 !== 10) return 0; // open frame — game over after two balls
  if (idx + 2 >= rolls.length) return 10; // ball 3, fresh rack after a spare
  return 0; // game over
}

export function isGameComplete(rolls: number[]): boolean {
  return rolls.length > 0 && maxPinsForNextRoll(rolls) === 0;
}

export function isValidRoll(rolls: number[], pins: number): boolean {
  return Number.isInteger(pins) && pins >= 0 && pins <= maxPinsForNextRoll(rolls);
}

export function computeGame(rolls: number[]): Game {
  const frames: Frame[] = [];
  let i = 0;

  for (let f = 0; f < FRAME_COUNT && i < rolls.length; f++) {
    if (f === FRAME_COUNT - 1) {
      const frameRolls = rolls.slice(i, i + 3);
      const isStrike = frameRolls[0] === 10;
      const isSpare = !isStrike && frameRolls.length >= 2 && frameRolls[0] + frameRolls[1] === 10;
      const need = isStrike || isSpare ? 3 : 2;
      const done = frameRolls.length >= need;
      frames.push({
        index: f,
        rolls: frameRolls,
        isStrike,
        isSpare,
        score: done ? frameRolls.reduce((a, b) => a + b, 0) : null,
      });
      break;
    }

    if (rolls[i] === 10) {
      const bonus = rolls.slice(i + 1, i + 3);
      frames.push({
        index: f,
        rolls: [10],
        isStrike: true,
        isSpare: false,
        score: bonus.length === 2 ? 10 + bonus[0] + bonus[1] : null,
      });
      i += 1;
      continue;
    }

    const r1 = rolls[i];
    const r2 = rolls[i + 1];
    if (r2 === undefined) {
      frames.push({ index: f, rolls: [r1], isStrike: false, isSpare: false, score: null });
      break;
    }
    const isSpare = r1 + r2 === 10;
    const bonus = rolls[i + 2];
    frames.push({
      index: f,
      rolls: [r1, r2],
      isStrike: false,
      isSpare,
      score: isSpare ? (bonus !== undefined ? 10 + bonus : null) : r1 + r2,
    });
    i += 2;
  }

  const runningTotal: (number | null)[] = [];
  let sum = 0;
  let broken = false;
  for (const fr of frames) {
    if (broken || fr.score === null) {
      runningTotal.push(null);
      broken = true;
      continue;
    }
    sum += fr.score;
    runningTotal.push(sum);
  }

  const complete = frames.length === FRAME_COUNT && frames[FRAME_COUNT - 1].score !== null;
  return {
    frames,
    runningTotal,
    total: complete ? runningTotal[FRAME_COUNT - 1] : null,
    complete,
  };
}

export function addRoll(rolls: number[], pins: number): number[] {
  if (!isValidRoll(rolls, pins)) return rolls;
  return [...rolls, pins];
}

/** A short scorecard-style summary line, e.g. "X 7/ 9- ... = 133". */
export function shareText(rolls: number[]): string {
  const { frames, total, complete } = computeGame(rolls);
  const marks = frames.map((f) => frameMarks(f).join('')).join(' ');
  return complete ? `🎳 ${marks} = ${total}` : `🎳 ${marks} (in progress)`;
}

function markFor(pins: number, prev?: number): string {
  if (pins === 10) return 'X';
  if (pins === 0) return '-';
  if (prev !== undefined && prev + pins === 10) return '/';
  return String(pins);
}

/**
 * Scoresheet-style marks for one frame's boxes: 2 boxes for frames 1-9 (the
 * first is left blank on a strike, by convention), up to 3 for frame 10.
 */
export function frameMarks(frame: Frame): string[] {
  if (frame.index !== FRAME_COUNT - 1) {
    if (frame.isStrike) return ['', 'X'];
    if (frame.rolls.length < 2) return [markFor(frame.rolls[0])];
    return [markFor(frame.rolls[0]), frame.isSpare ? '/' : markFor(frame.rolls[1])];
  }
  // Frame 10: each ball after a strike or a completed spare is bowled against
  // a freshly-racked 10, so it must never be compared to the ball before it
  // unless that ball left the *same* rack standing.
  const [r0, r1, r2] = frame.rolls;
  const marks = [markFor(r0)];
  if (r1 === undefined) return marks;
  if (r0 === 10) {
    marks.push(markFor(r1)); // fresh rack after a strike — no prev
    if (r2 === undefined) return marks;
    marks.push(r1 === 10 ? markFor(r2) : markFor(r2, r1));
  } else {
    marks.push(markFor(r1, r0)); // same rack as ball 1 — can complete a spare
    if (r2 === undefined) return marks;
    marks.push(markFor(r2)); // fresh rack after the spare — no prev
  }
  return marks;
}

// ---- persistence / share state ----

export function encodeRolls(rolls: number[]): string {
  return rolls.join('.');
}

export function decodeRolls(encoded: string): number[] {
  if (!encoded) return [];
  const out: number[] = [];
  for (const part of encoded.split('.')) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 10) return []; // malformed — start fresh rather than guess
    out.push(n);
  }
  // replay through addRoll so a tampered/impossible sequence can't produce a bogus board
  let rolls: number[] = [];
  for (const n of out) {
    const next = addRoll(rolls, n);
    if (next === rolls) return rolls; // stop at the first illegal roll
    rolls = next;
  }
  return rolls;
}
