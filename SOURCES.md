# Sources & method

Income Rank invents no income figures. It bakes a static income distribution from
official, public data, then ranks your input against it **entirely in your browser** —
your income never touches a server. This page lists every source, what it's used for,
its licence, and its vintage, so anyone can check the numbers themselves.

Last verified: **2026-06-05** (against the live World Bank / OWID data).

---

## How a rank is produced (one paragraph)

Your gross income is converted to **2021 PPP international dollars per day**
(`income ÷ 365 ÷ PPP-factor`), then looked up in a **population-weighted mixture of
171 country income distributions** built from the World Bank's Poverty & Inequality
Platform (PIP). Your **global rank** is your position in that world distribution; your
**local rank** is your position within your own country's distribution. Each country's
curve is built from its PIP percentile thresholds, with a **Pareto tail (α ≈ 2)** fitted
to its well-measured upper-middle band — because household surveys top-code the rich, the
extreme top must be *extrapolated*, not read off. This is the standard technique
(Lakner & Milanovic). Above the **top 1%**, the world curve's tail *shape* is then
recalibrated to the top-tail curvature measured by the **World Inequality Database
(WID.world)** — importing only WID's scale-free Pareto shape (α drops from ~1.79 toward
~1.68 at the very top), anchored at the survey's own p99 level, **not** WID's
different-basis dollar levels. The build validates the body against published global
anchors and the tail shape against WID (see `scripts/build-data.ts` → `verify()`).

It is deliberately an **Estimate** that flatters you, and every bias is disclosed — see
[Known biases & limits](#known-biases--limits).

---

## Primary data sources

All fetched in `scripts/build-data.ts` (the `SRC` object), cached under
`scripts/.cache/`, and baked to static JSON committed in `src/data/` and `public/data/`.

| What | Provider | Endpoint / file | Licence |
|---|---|---|---|
| **Income distribution** — 100 percentile bins per country-year, 2021 PPP (the core dataset) | World Bank **Poverty & Inequality Platform (PIP)** | [`world_100bin_revised.csv`](https://datacatalogfiles.worldbank.org/ddh-published/0063646/DR0090357/world_100bin_revised.csv) · catalog: [dataset 0063646](https://datacatalog.worldbank.org/search/dataset/0063646) | **CC0** (public domain) |
| **PPP conversion factors** (2021) | World Bank PIP (ICP price surveys) | [`pip/v1/aux?table=ppp`](https://api.worldbank.org/pip/v1/aux?table=ppp&format=json) | CC BY 4.0 |
| **Population** (weights) | World Bank Open Data (source: UN Population Division) | [`SP.POP.TOTL`](https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?mrv=1&per_page=400&format=json) | CC BY 4.0 |
| **Official exchange rate** (2021, for the price-level rule) | World Bank Open Data (source: IMF IFS) | [`PA.NUS.FCRF`](https://api.worldbank.org/v2/country/all/indicator/PA.NUS.FCRF?date=2021&per_page=400&format=json) | CC BY 4.0 |
| **Country names / ISO / region** | World Bank Open Data | [`/v2/country`](https://api.worldbank.org/v2/country?per_page=400&format=json) | CC BY 4.0 |
| **Currency codes** (labels only — not rank-affecting) | REST Countries (community-run) | [`/v3.1/all?fields=cca3,currencies`](https://restcountries.com/v3.1/all?fields=cca3,currencies) | MPL-2.0 (project) |

**Vintage notes.** 2021 is the **PPP base year** (the World Bank's current standard; it
replaced 2017 PPP). Survey years span **2021–2024**; population weights are **2024**
(`mrv=1`). So "2021" labels the price basis, not the year of every input.

---

## Calibration / cross-check sources

The assembled world curve is checked against independent estimates that use the **same
PIP 2021-PPP base** — an apples-to-apples audit, not a borrowed number.

- **Our World in Data** — global daily median & decile thresholds (2021 PPP):
  [daily-median-income](https://ourworldindata.org/grapher/daily-median-income) ·
  [decile thresholds](https://ourworldindata.org/grapher/threshold-income-or-consumption-for-each-decile) ·
  [daily mean income](https://ourworldindata.org/grapher/daily-mean-income)
- **Giving What We Can — "How Rich Am I" methodology**:
  [givingwhatwecan.org/how-rich-am-i-methodology](https://www.givingwhatwecan.org/how-rich-am-i-methodology)
- **OWID notebook** (Pablo Arriagada), `pip_global_percentiles.csv`:
  [github.com/owid/notebooks/…/global_distribution_giving_what_we_can](https://github.com/owid/notebooks/tree/main/PabloArriagada/global_distribution_giving_what_we_can)
- **Anand & Segal, "Who Are the Global Top 1%?"** (global top-1% threshold):
  [LSE Working Paper 8](https://www.lse.ac.uk/International-Inequalities/Assets/Documents/Working-Papers/Working-Paper-8-Who-are-the-Global-Top-1.pdf)
- **Lakner & Milanovic, "Global Income Distribution"** (the Pareto top-decile method this build uses):
  [World Bank PRWP 6719](https://documents1.worldbank.org/curated/en/914431468162277879/pdf/WPS6719.pdf)
- **World Bank, "Global Poverty Revisited Using 2021 PPPs"** (new $3.00 / $4.20 / $8.30 lines):
  [PRWP 11137](https://documents1.worldbank.org/curated/en/099503206032533226/pdf/IDU-e2e09dcf-0af2-481a-a60a-64adf28171d0.pdf)
- **World Bank PIP platform** (poorest-country medians): [pip.worldbank.org](https://pip.worldbank.org/)
- **World Inequality Database (WID.world)** — World pre-tax income thresholds
  (`WID_data_WO.csv`, variable `tptincj992`, 2021 PPP). **Used to shape the extreme top
  tail** (above the top 1%): [wid.world/bulk_download](https://wid.world/bulk_download/WID_data_WO.csv) ·
  [codes dictionary](https://wid.world/codes-dictionary/) · method
  [Blanchet, Fournier & Piketty (generalized Pareto)](https://wid.world/gpinter).
  WID is a *different, fatter* per-adult pre-tax national-income basis — its dollar levels
  are **not** imported (that would be a basis error); only the scale-free tail shape is.
  This is also why third-party "top 1% = $250k/yr" figures don't contradict this site.
  Context: [World Inequality Report 2022, Table 1.1](https://wir2022.wid.world/www-site/uploads/2021/12/WorldInequalityReport2022_Full_Report.pdf).

### How well it matches (verified 2026-06-05)

| Quantity | This site | Independent published value | Margin |
|---|---|---|---|
| Global median (P50), 2021 PPP $/day | **$8.8** | OWID/PIP World: $8.70 (2022), $9.00 (2023) | sits between — **~1%** |
| Global top 10% (P90) | **$51.9** | OWID/PIP World P90: $51.6–$51.8 (2021–22) | **~0.2%** |
| Global top 1% threshold | **$61,940/yr** | Anand & Segal $50,600 (2012) → ~$59,700 (2021) | **+3.7%** |
| Top-tail Pareto α (p99→p99.9 / p99.9→p99.99) | **1.79 / 1.68** | WID.world WO 2021 (1.79 / 1.68) | **exact** (shape imported) |
| Poorest-country medians (e.g. Madagascar) | **2.24** | PIP most-recent survey: 2.239 | exact to 3 dp |

The site's own `verify()` step prints the full comparison at build time: the **body
(≤ p99) is under ~5%** against published OWID/GWWC anchors, and the **tail (> p99) shape
matches WID.world** by construction.

---

## "Iconic goods" prices (the flavour lines)

The travel-arbitrage lines ("≈ 3,000 bowls of phở…") divide your income, converted at
**market exchange rates**, by a hard-coded local price (`GOODS_SMALL` / `GOODS_BIG` in
`src/lib/perspectives.ts`). These are approximate reference prices, **not survey data**,
and they do **not** affect your percentile rank — they're colour on top of it. Current
ballparks: phở Hanoi ~$2, biryani Mumbai ~$2.5, taco CDMX ~$1.1, Big Mac (US) ~$5.7,
flat white Melbourne ~$3.4, pint London ~$7, Bali villa ~$70/night, Lisbon 1-BR ~$1,350/mo.

---

## Famous-income tail ("keep going" → Elon Musk)

When you climb past your own floor, the tower passes a ladder of globally recognizable
people and stops at the ceiling, **Elon Musk**. These are a deliberately rough yardstick
(`FAMOUS` in `src/lib/tower.ts`), **mixed-basis and disclosed**, estimated for 2025–2026:

| Person | ~$/day | Basis |
|---|---|---|
| MrBeast | $233K | annual **earnings** ÷ 365 (Forbes Top Creators) |
| Cristiano Ronaldo | $750K | annual **earnings** ÷ 365 (Forbes Highest-Paid Athletes 2025) |
| Taylor Swift | $1.1M | annual **earnings** ÷ 365 (Forbes celebrity estimate) |
| Larry Ellison | $16M | year-over-year **wealth growth** ÷ 365 (Forbes Billionaires 2026) |
| Jeff Bezos | $120M | **wealth growth** ÷ 365 (Forbes Billionaires 2026) |
| **Elon Musk** | **$1.4B** | **wealth growth** ÷ 365 (Forbes Billionaires 2026: ~$839B, up ~$500B YoY) |

For creators/athletes/entertainers this is real **annual earnings** (salary + endorsements +
business). For billionaires it is **year-over-year wealth growth** — paper gains on stock, not
salary; it swings wildly day to day and can be negative. So the billionaire rungs are **not**
apples-to-apples with a paycheck. Treat all of these as cited order-of-magnitude estimates.

Sources: [Forbes World's Billionaires 2026](https://www.forbes.com/real-time-billionaires/) ·
[Forbes Highest-Paid Athletes](https://www.forbes.com/athletes/) · Forbes Top Creators /
celebrity earnings · [Bloomberg Billionaires Index](https://www.bloomberg.com/billionaires/)
(cross-check). Figures verified 2026-06.

---

## Known biases & limits

Every result is a labelled **Estimate**, and **every known bias points upward** — owned,
not hidden (see `docs/adr/0001-income-rank-methodology.md` and `CONTEXT.md`):

1. **Individual vs household.** Your *individual gross* income is compared to a
   *household per-capita welfare* distribution, with **no household-size division**. This
   is the single biggest upward tilt and the most legitimate criticism.
2. **Gross vs net.** Many high-income countries report *net/disposable* income; you enter
   *gross*. No tax model is applied.
3. **Whole population denominator.** The rank counts *every living person* — children and
   non-earners included — not just earners.
4. **Coverage = 171 countries / ~7.9 billion people**, not the literal ~8.1 billion world
   total. Copy that says "the world" means this covered population.
5. **Survey drift.** Surveys are 2021–2024; a 2026 salary ranks slightly high as incomes
   have risen since.
6. **Extreme tail is modelled, not measured.** Above the top 1%, household surveys top-code
   the rich, so the tail is a Pareto curve. Its *shape* is now calibrated to **WID.world**'s
   measured world top-tail (α ≈ 1.79 → 1.68), anchored at the survey's p99 level — but it is
   still a model, and WID's basis differs from PIP's, so treat ultra-rich ranks (and the
   punchy one-liners) as directional, not exact. The implied top-0.1% threshold is ~$618/day
   (2021 PPP, survey basis). Earlier versions extrapolated with a single α ≈ 2 and ran ~10–30%
   off published anchors at the extreme top; the WID shape replaces that.

---

## Reproduce it yourself

```bash
bun install
bun run data    # re-fetch every source above and rebuild the JSON (prints verify())
bun test        # re-derive the ranks and perspective sentences
```

Every number on the site is a deterministic function of the committed data — nothing is
hand-entered.
