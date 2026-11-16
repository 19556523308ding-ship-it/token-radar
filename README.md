# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/19556523308ding-ship-it/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/19556523308ding-ship-it/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: every pre-token protocol in the sealed DefiLlama snapshot, ranked by what its token would be worth at launch if its record stayed as it is — with a concrete farm plan for each one.

The model (radar-2, in `lib/model.ts`, stated in full on the dashboard) scores every protocol with the same arithmetic from the snapshot's own figures:

```
implied = TVL x sector multiple x momentum x maturity x breadth x product factor
```

- **Sector multiple** — the share of TVL a launched token of that sector plausibly captures (Dexs ×0.60 down to farms ×0.20).
- **Momentum** — the 7-day TVL change, clamped and weighted ×0.6.
- **Maturity** — rises with the protocol's tracked age.
- **Breadth** — +4% per extra chain, to six.
- **Product factor** — ×0.15 for wrapped, staked or bridged products of assets that already trade (a wrapped bitcoin is a claim on bitcoin, not a launch), ×1 otherwise.

The board covers all 40 watchlist protocols and ranks every other rankable pre-token protocol below the floor as well. Protocols whose token already trades sit in a separate Live view at the market's own values, never mixed into the ranking. The dashboard (`dashboard/`) is a static page with no network: search, category and chain filters, a watchlist toggle, sorting, and a detail view per protocol showing its model factors and its seven-step farm plan, each step with a cost and a time.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path-to-snapshot.json>
```

Node 22.18 or later, standard library only. The program writes `out/board.json`, `out/data.js`, `out/dashboard/`, `out/screenshots/` and `out/dossier.json`, deterministically — the same snapshot in, the same bytes out.

---

<sub>Entered on [make.fun](https://make.fun/?ref=r5k9102r&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
