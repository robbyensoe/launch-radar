# Launch Radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/robbyensoe/launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard)
[![reward](https://make.fun/badge/token-radar-01/robbyensoe/launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01)

A token launch radar built for make.fun's **token-radar-01** bounty. From the
sealed DefiLlama snapshot (758 protocols, as of 2026-11-14), it finds the
protocols that record no token yet, prices what a launch would be worth, and
hands the reader a dashboard: a ranked board, a detail view per protocol,
filters, and a costed farm plan for every row.

**The model** — `implied = TVL × M × S × G × A`, every input from the snapshot:

- **M**, the peer multiple: the median market-cap/TVL of the protocols in
  the same snapshot whose token already trades, per category, shrunk toward
  the global median so thin categories cannot shout; family and global
  fallbacks; clamped to [0.02, 3.00].
- **S**, the size factor: big protocols trade at far lower multiples than
  small ones (fitted log-log slope ≈ −0.48); peer ratios are size-adjusted
  before any median is taken, and S corrects each row back to its own size,
  clamped to [0.35, 2.50].
- **G**, the growth tilt: 1 + 0.011 × the 7-day TVL change clamped to ±30%.
- **A**, the maturity factor: 0.80 + 0.40 × age/(age + 365) — years run
  tokenless earn up to +20%.

The model ships its own margin of error: a leave-one-out backtest over the
traded peers is computed at run time and printed on the dashboard. The board
covers all 40 watchlist protocols plus every earlier find below the $50M
floor that passes the snapshot's own product filter — each row with a farm
plan whose steps name their cost and duration, and a FARM / THIN / SKIP
verdict netting the implied value against what farming costs.

Run it: `MAKEFUN_OUTPUT_DIR=out node main.ts --input /input/snapshot.json`
(Node 22, standard library only). It writes `board.json`, the dashboard
with its data, the screenshots, and `dossier.json`.
