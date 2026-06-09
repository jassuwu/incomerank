# Current-nominal re-projection: market FX + CPI to today, not frozen 2021

Supersedes the fixed-2021-FX basis in [ADR-0001](./0001-income-rank-methodology.md).
See [`SOURCES.md`](../../SOURCES.md) for provenance.

## Context

ADR-0001 converted both the user's income and every country distribution at the **2021**
official exchange rate (`PA.NUS.FCRF?date=2021`), accepting the real-terms drift as a
disclosed limitation. But the user enters a *today* salary, and for currencies that have
moved a lot since 2021 (INR 74→84, JPY 110→151, plus the hyperinflators) a 2021 rate
misranks them — the Indian/Japanese user looked too rich, and a current nominal peso or
lira salary converted at a 2021 rate is nonsense.

The naive fix — just swap in today's FX — is *worse*. The 2021 FX was quietly doing
inflation-offset work (relative PPP): a currency depreciates roughly in step with its
excess inflation, so 2021-real welfare at 2021 FX ≈ correct. Updating FX **without** also
inflating the distribution by CPI breaks that offset and shows high-inflation countries at
a fraction of their real income (Argentina ≈ 1/11th). FX and CPI must move together.

## Decision

**Re-project every country's 2021-PPP distribution into _current_ nominal US$, and convert
the user at the current exchange rate.** For country C with target year T (latest annual):

```text
price level   pl_C = ppp2021_C · CPI_C(2021→T) / FX_C(T)
distribution  w (intl$ 2021)        →  w · pl_C            (current US$)
user          income (current LCU)  →  income / FX_C(T)    (current US$)
```

Both land on one basis (current nominal US$), so the global rank is internally consistent.
New build input: `FP.CPI.TOTL` alongside `PA.NUS.FCRF`, fetched over 2021–latest.

- **Missing CPI → relative-PPP fallback.** Some countries (notably Argentina) don't report
  CPI to the World Bank. There, infer inflation from the currency itself:
  `CPI_C(2021→T) ≈ (FX_C(T)/FX_C(2021)) · CPI_US(2021→T)`. This keeps the distribution sane
  (Argentina `pl` 0.05 → 0.52, an 11× correction) instead of the FX-only catastrophe. The
  build logs the split — this release: **156 reported · 10 implied · 1 us-only**.
- **PPP basis is untouched.** Only the nominal (market-FX) basis re-projects; the PPP `cdf`,
  the local "at home you're Xth" rank, and the OWID/GWWC body anchors are unchanged
  (`verify()` still ≤5%). The local PPP rank therefore keeps the pre-existing 2021-real
  drift — a separate, secondary lens we deliberately did not re-base here.
- **`priceLevel` changes meaning** — now the intl$2021 → current-US$ scale (US = US-CPI
  ratio ≈ 1.16, not 1). `showBuyingPower` and `where.ts` were updated to stop assuming a
  US-centred price index; the headline rank already used `income ÷ FX` directly and was fine.

## Considered options

- **Keep frozen 2021 FX:** rejected — a 2026 salary at a 2021 rate misranks weak-currency
  and hyperinflation countries; the whole point was to fix that.
- **FX-only, no CPI:** rejected — breaks the relative-PPP offset; high-inflation countries
  crater (Argentina ~1/11th of real income).
- **Live spot FX (client fetch):** deferred — baked-at-deploy annual FX keeps the site
  static/reproducible and is enough; per-visit FX is a heavier client change for little gain.

## Consequences

- Ranks shift, mostly small and always toward honesty: weak-currency countries (India,
  Japan) rank slightly lower in US$; the US distribution inflates ~16% into 2024 dollars.
  Headline example: ₹50,000/mo **16% → ~18%**.
- `fxYear` and `cpiRatio` are stored per country for transparency; `world.json` records the
  nominal-basis formula.
- The README caption and the Remotion demo still show the old 16% and need a synchronized
  refresh (separate change).
- `fetchCached` now retries — the World Bank API intermittently 400s.
