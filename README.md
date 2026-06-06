# Income Rank

**Find your global income rank.** A minimal reveal microsite: enter what you make, see where your income places you among everyone on Earth. Live at [incomerank.jass.gg](https://incomerank.jass.gg).

Your income never leaves your browser — all ranking runs client-side against pre-baked World Bank data.

## How it works

1. You enter a gross income in your local currency + period.
2. It's converted to 2021 international dollars (`income / 365 / PPP`).
3. That value is looked up in a population-weighted **world** income distribution (global rank) and your **country's** distribution (local rank).
4. A staged reveal animates the result; a privacy-safe card/link lets you share it.

Results are a deliberately-labelled **estimate** (see [`CONTEXT.md`](./CONTEXT.md) and [`docs/adr/`](./docs/adr)). The methodology and its known upward biases are disclosed in-product behind "how this works".

## Stack

- **Astro 6** (`output: 'static'`) + **Tailwind v4** (`@tailwindcss/vite`), TypeScript, Bun.
- Calculator is a plain `<script>` (no framework island); near-zero shipped JS.
- Data baked to static JSON from **World Bank PIP** (2021 PPP percentiles).
- Share/OG cards pre-rendered at build with **satori + resvg** (path-based `/r/N`).
- Deploys to **Cloudflare Workers Static Assets** (no adapter — [ADR-0002](./docs/adr/0002-static-cloudflare-path-based-og.md)).

## Commands

```bash
bun install
bun run dev      # local dev server
bun run data     # rebuild data JSON from World Bank sources (network; cached)
bun run og       # pre-render OG share cards → public/og/
bun run build    # bun run og && astro build  →  dist/
bun run preview  # serve the production build
bun test         # unit tests for the ranking/parse/copy logic
```

## Data pipeline

`scripts/build-data.ts` fetches and bakes (downloads cached under `scripts/.cache/`):

- **World Bank PIP** percentiles (dataset 0063646, 2021 PPP) — income distributions.
- **PIP** 2021 PPP factors; **World Bank** population (`SP.POP.TOTL`) and 2021 FX (`PA.NUS.FCRF`, for the price-level contextual rule).
- **REST Countries** — currency codes; **World Bank** — country names.
- **WID.world** (World pre-tax thresholds, 2021 PPP) — top-tail *shape* above the top 1%.

Each country's CDF is built from its percentile thresholds with a Pareto tail (α≈2) fit on its well-measured upper-middle; the world CDF is the population-weighted mixture. Above the top 1% the world tail's shape is recalibrated to WID.world's measured top-tail (shape only, not its different-basis levels). Output is validated against published global anchors for the body (Giving What We Can / Our World in Data, same PIP 2021 base) and against WID for the tail shape — see the `verify()` step.

Generated data (`src/data/`, `public/data/`) is committed so the site builds without network access. OG images are regenerated at build.

## Deploy (Cloudflare)

`jass.gg` must be an active zone on the Cloudflare account.

```bash
bun run build
bunx wrangler deploy   # uploads ./dist, binds incomerank.jass.gg (wrangler.jsonc)
```

## Attribution

Income distributions from the **World Bank Poverty & Inequality Platform (PIP)** —
the *Percentiles* dataset ([0063646](https://datacatalog.worldbank.org/search/dataset/0063646)),
released under **CC0** (public domain). Population, exchange-rate, PPP-factor and country
data are World Bank Open Data (**CC BY 4.0**); currency codes from REST Countries.
Calibration cross-checked against Giving What We Can and Our World in Data (same PIP
2021-PPP base); the extreme top tail's shape is calibrated to the World Inequality
Database (**WID.world**).

**Full provenance, licences, vintages and the independent verification table are in
[`SOURCES.md`](./SOURCES.md).**
