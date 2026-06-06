# WID-calibrated top tail + true vs covered population

Supersedes the deferred top-tail item in [ADR-0001](./0001-income-rank-methodology.md)
and the population-total framing. Prompted by users distrusting the numbers; see
[`SOURCES.md`](../../SOURCES.md) for the full provenance and verification.

## Context

ADR-0001 built each country's tail as a Pareto (α≈2) above p90 and deferred a WID
top-income splice to v2. The `verify()` step showed the pooled world tail running **+11%
at p99.5 and +34% at p99.9** against hand-coded anchors — an unanchored extrapolation
exactly where the product's most dramatic claims live. Separately, `world.json`'s
`totalPopulation` was the **sum of the 171 covered countries** (~7.92B), not the true
world total (~8.14B), yet copy framed it as "everyone on Earth".

## Decisions

1. **Recalibrate the world top tail to WID.world — shape only, not levels.** Above p99,
   replace the survey mixture's tail with a Pareto whose per-segment slope comes from the
   World Inequality Database's measured World pre-tax top-tail (`WID_data_WO.csv`,
   `tptincj992`, 2021 PPP): α ≈ **1.79** (p99→p99.9) then **1.68** (p99.9→p99.99),
   anchored at the survey's own p99 *level*. We import only WID's **scale-free shape** via
   threshold ratios — never its dollar levels, which are a structurally higher, different
   basis (per-adult pre-tax national income vs PIP per-capita survey welfare). Splicing
   levels would conflate a unit change, a concept change and a coverage correction.
   - Effect: body (≤ p99) unchanged and still within ~5% of OWID/GWWC; tail is fatter and
     steepens toward the top, so ultra-high ranks become **less** exclusive (top-0.1%
     threshold $370→~$618/day; USA $500k/yr 0.01%→0.03%). Less flattering = more honest.
   - Constants live in `scripts/build-data.ts` (`WID_WO_2021`, `widTailF`, `spliceWidTail`);
     refreshable from WID. `verify()` now checks the body against published anchors and the
     tail's implied α against WID.

2. **Distinguish `worldPopulation` from `coveredPopulation`.** `world.json` now carries
   both: `worldPopulation` (true global total, World Bank `WLD`, ~8.14B) used for all
   "X people live on less" counts, and `coveredPopulation` (the 171-country sum the CDF is
   built on). The ~3% uncovered (mostly small/poor/survey-less states) are treated as
   following the curve at a given x — honest for high earners, where ~all are below. The
   `totalPopulation` field is removed.

## Considered options (tail)

- **Splice WID dollar levels above p99:** rejected — basis mismatch inflates the tail by a
  unit×concept×coverage product, not the survey under-capture we want to fix.
- **Keep single fitted α≈2:** rejected — unanchored; ran 10–30% hot at the extreme top and
  is thinner than WID's measured curve.
- **Full generalized-Pareto interpolation (gpinter):** rejected for now — heavier; the
  per-segment ratio method captures the steepening curvature at far less complexity.

## Consequences

- The reveal's headline ("top 1% starts near $61,940/yr") is anchored at p99 and unchanged;
  only ranks above the top 1% shift, slightly down for the ultra-rich.
- WID is now a build input (network fetch is avoidable — the four reference thresholds are
  pinned in-code with a citation). README, `SOURCES.md`, `CONTEXT.md` and the in-product
  "Sources & method" panel disclose it.
- The tail remains a **model**, not a measurement; it is still labelled an Estimate.
