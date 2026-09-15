# Bowling Score Calculator

Tap the pins for each roll, get a correctly-scored 10-frame game, live.

- Strikes, spares, and the tricky **10th-frame bonus balls** (with the
  correct pin-reset rules) all handled
- Only shows legal pin counts for the next roll
- Undo, new game, best-score tracking (this browser), shareable scorecard
  text and link
- Saves your in-progress game locally — works offline, no account

## Develop

```
npm install
npm run dev
npm run build      # tsc --noEmit && vite build
node --experimental-strip-types --test src/bowling.test.mjs
```

The engine (`computeGame`, `maxPinsForNextRoll`, `frameMarks`, `shareText`,
URL/localStorage codec) is in `src/bowling.ts`. 17 Node tests in
`src/bowling.test.mjs`, including a perfect game (300), a classic reference
game (133), and the 10th-frame pin-reset edge cases.

## Deploy

Static assets on Cloudflare Workers (`wrangler.jsonc`). Live at
<https://bowling-score-calculator.correia95.workers.dev/>.
