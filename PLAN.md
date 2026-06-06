# Income Rank — v1 Build Plan

One-line: **Find your global income rank.** A minimal reveal machine at `incomerank.jass.gg`.

See `CONTEXT.md` for domain language and `docs/adr/` for the two load-bearing decisions.

## Methodology (ADR-0001)

1. Source: World Bank PIP **percentiles** dataset, 100 bins/country, **2021 PPP** (`world_100bin_revised.csv`, dataset 0063646; OWID mirror as fallback).
2. Build a **population-weighted world CDF** by pooling all ~160 economies (`pop_share × SP.POP.TOTL`), plus a per-country CDF for local rank.
3. Convert a user's gross income to 2021 international dollars/day: `gross_local / 365 / PPP2021(country)` using `PA.NUS.PRVT.PP` (2021).
4. Look up the daily value in the world CDF (global rank) and country CDF (local rank).
5. **Parametric top tail**: fit a Pareto/log-normal tail within the top bin so high earners get distinct, monotonic ranks (ADR-0010 decision).
6. **Household-free, gross, whole-population** → deliberately inflated; disclosed in the "how this works" expander. Never claims an exact salary rank.

## Architecture (ADR-0002)

```
scripts/build-data.ts        # fetch PIP+PPP+pop -> emit static JSON (offline, repeatable)
scripts/build-og.ts          # satori + @resvg/resvg-js -> public/og/top-N.png at build
src/data/world.json          # pooled global CDF (compact, ~1-2k points)
src/data/countries/<ISO>.json# per-country CDF + meta (currency, period, ppp, year, welfare_type)
src/data/countries.index.json# selectable list + Core-5 polish flags
src/lib/percentile.ts        # CDF lookup + interpolation (pure, unit-tested)
src/lib/ppp.ts               # salary -> intl$/day conversion (pure, unit-tested)
src/lib/format.ts            # locale-aware currency/number parse + format
src/lib/rank-copy.ts         # rank -> hero/people-count/buying-power strings
src/scripts/calculator.ts    # browser: read input -> compute -> animate reveal
src/scripts/locale.ts        # client locale -> default country/currency/period
src/components/*.astro        # InputCard, Reveal, MethodologyExpander, CountryPicker, ShareCard
src/layouts/Layout.astro      # imports global.css (Tailwind v4)
src/pages/index.astro         # the input + reveal screen
src/pages/r/[rank].astro      # path-based shareable result (getStaticPaths 1..99) + OG meta
src/styles/global.css         # @import "tailwindcss"; + theme tokens
wrangler.jsonc                # Workers static assets + custom_domain incomerank.jass.gg
```

Static-first: `output: 'static'`, no Cloudflare adapter in v1. Income never leaves the browser.

## Build phases

- **P1 Foundation** — Tailwind v4 install, scaffold cleanup, project structure, wrangler.jsonc.
- **P2 Data pipeline** — `build-data.ts`; verify real ranks (US $72k, $200k; IN ₹80k/mo; etc.). **Checkpoint: eyeball numbers.**
- **P3 Core logic (TDD)** — `percentile.ts`, `ppp.ts`, `format.ts` with tests.
- **P4 Input screen** — locale detect, country picker, currency/period, parsing.
- **P5 Reveal** — staged suspense animation, hero + people-count + contextual buying-power + local/global contrast + methodology expander.
- **P6 Result page + OG** — `/r/[rank]`, build-time `top-N.png`, share card + Web Share/download.
- **P7 Deploy** — wrangler to `incomerank.jass.gg`; visual QA.

## Deferred to v2

Extra share skins (Serious/Brutal/Localized), WID top-income splice, optional household-size input, runtime OG endpoint (paid plan), edge geo detection.
