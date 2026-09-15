import { useEffect, useMemo, useState } from 'react';
import {
  addRoll,
  computeGame,
  decodeRolls,
  encodeRolls,
  FRAME_COUNT,
  type Frame,
  frameMarks,
  isGameComplete,
  maxPinsForNextRoll,
  shareText,
} from './bowling.ts';

const LS_KEY = 'bowling-score-calculator:v1';

function loadRolls(): number[] {
  const fromUrl = decodeRolls(new URLSearchParams(location.search).get('r') ?? '');
  if (fromUrl.length) return fromUrl;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return decodeRolls(JSON.parse(raw).rolls ?? '');
  } catch {
    /* ignore */
  }
  return [];
}

function frameLabel(index: number): string {
  return index === 9 ? '10' : String(index + 1);
}

export default function App() {
  const [rolls, setRolls] = useState<number[]>(loadRolls);
  const [copied, setCopied] = useState(false);
  const [best, setBest] = useState<number | null>(null);

  const game = useMemo(() => computeGame(rolls), [rolls]);
  const maxPins = useMemo(() => maxPinsForNextRoll(rolls), [rolls]);
  const complete = useMemo(() => isGameComplete(rolls), [rolls]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ rolls: encodeRolls(rolls) }));
    } catch {
      /* ignore */
    }
    const qs = rolls.length ? `?r=${encodeRolls(rolls)}` : location.pathname;
    window.history.replaceState(null, '', qs);
  }, [rolls]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const b = raw ? JSON.parse(raw).best : null;
      if (typeof b === 'number') setBest(b);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (game.complete && game.total != null) {
      setBest((b) => {
        const next = b == null || game.total! > b ? game.total! : b;
        try {
          const raw = localStorage.getItem(LS_KEY);
          const prev = raw ? JSON.parse(raw) : {};
          localStorage.setItem(LS_KEY, JSON.stringify({ ...prev, best: next }));
        } catch {
          /* ignore */
        }
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.complete, game.total]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const roll = (pins: number) => setRolls((r) => addRoll(r, pins));
  const undo = () => setRolls((r) => r.slice(0, -1));
  const newGame = () => setRolls([]);

  const share = () => {
    navigator.clipboard?.writeText(shareText(rolls)).then(
      () => setCopied(true),
      () => {},
    );
  };

  const currentFrame = game.frames.length ? game.frames[game.frames.length - 1] : null;
  const currentFrameIndex = complete ? FRAME_COUNT : currentFrame && currentFrame.score === null ? currentFrame.index : Math.min(FRAME_COUNT - 1, game.frames.length);

  return (
    <div className="app">
      <header>
        <h1>Bowling Score Calculator</h1>
        <p className="tag">
          Tap the pins knocked down on each roll and get a correctly-scored, live 10-frame
          scoreboard — strikes, spares and the 10th-frame bonus balls all handled.
        </p>
      </header>

      <div className="board-wrap">
        <div className="board">
          {Array.from({ length: FRAME_COUNT }, (_, i) => i).map((i) => {
            const f: Frame | undefined = game.frames[i];
            const marks = f ? frameMarks(f) : [];
            const boxCount = i === FRAME_COUNT - 1 ? 3 : 2;
            return (
              <div key={i} className={`frame ${i === currentFrameIndex && !complete ? 'active' : ''}`}>
                <div className="frame-num">{frameLabel(i)}</div>
                <div className="marks" data-boxes={boxCount}>
                  {Array.from({ length: boxCount }, (_, b) => (
                    <span key={b} className="mark-box">
                      {marks[b] ?? ''}
                    </span>
                  ))}
                </div>
                <div className="frame-score">{f && game.runningTotal[i] != null ? game.runningTotal[i] : f ? '…' : ''}</div>
              </div>
            );
          })}
        </div>
      </div>

      {complete ? (
        <section className="result">
          <p className="r-big">
            Final score: <span>{game.total}</span>
          </p>
          {best != null && <p className="r-best">Best this browser: {best}</p>}
          <div className="actions">
            <button onClick={share}>{copied ? 'Copied' : 'Share result'}</button>
            <button onClick={newGame}>New game</button>
          </div>
        </section>
      ) : (
        <section className="pins">
          <p className="pins-label">
            {rolls.length === 0
              ? 'First roll — how many pins?'
              : maxPins === 10
                ? 'Fresh rack — how many pins?'
                : `${maxPins} pin${maxPins === 1 ? '' : 's'} standing`}
          </p>
          <div className="pin-grid">
            {Array.from({ length: maxPins + 1 }, (_, p) => maxPins - p).map((p) => (
              <button key={p} className={`pin ${p === 10 ? 'strike' : p === maxPins && maxPins < 10 && maxPins > 0 ? 'spare' : ''}`} onClick={() => roll(p)}>
                {p === 10 ? 'X' : p === maxPins && maxPins < 10 && maxPins > 0 ? `${p} /` : p}
              </button>
            ))}
          </div>
          <div className="actions">
            <button onClick={undo} disabled={!rolls.length}>
              Undo
            </button>
            <button onClick={newGame} disabled={!rolls.length}>
              New game
            </button>
          </div>
        </section>
      )}

      <section className="explainer">
        <h2>How bowling scoring works</h2>
        <p>
          Ten frames, two balls each (unless you strike). A <strong>strike</strong> — all ten pins
          on the first ball — scores 10 plus whatever you knock down on your next two balls. A{' '}
          <strong>spare</strong> — clearing the rack over two balls — scores 10 plus your very next
          ball. An open frame just scores the pins from its two balls.
        </p>
        <h3>The 10th frame</h3>
        <p>
          The last frame has nowhere to borrow a bonus from, so it gives you the bonus balls
          directly: a spare earns one extra ball, a strike earns two, and each bonus ball is bowled
          against a freshly re-racked set of ten pins.
        </p>
        <h3>Perfect game</h3>
        <p>
          Twelve strikes in a row — one in each of the first nine frames, plus three more in the
          10th — scores the maximum possible, 300.
        </p>
        <footer>Runs in your browser · saves your game locally · works offline</footer>
      </section>
    </div>
  );
}
