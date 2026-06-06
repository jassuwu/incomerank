# Income-rank methodology: PIP 2021-PPP percentiles, a deliberately inflated estimate

We rank a user's income against the **World Bank PIP "percentiles" dataset (100 bins per country, 2021 PPP base)**, pooling all ~160 economies by population into a single world CDF and computing a country-level CDF for the local rank. A user's gross income is converted to 2021 international dollars (`gross / 365 / PA.NUS.PRVT.PP[2021]`) and looked up against those CDFs. The top bracket is smoothed with a fitted parametric (Pareto/log-normal) tail so high earners get distinct, monotonic ranks.

The result is **deliberately inflated and labeled an Estimate**. We knowingly accept three upward biases rather than correct them: (1) an *individual* gross income is compared against *household per-capita* welfare with no household-size division; (2) most high-income countries report *net/disposable* income while users enter *gross*; (3) the denominator is *every living person*, children and non-earners included. This maximizes the "you're richer than you think" surprise that is the product's point, and is disclosed honestly in the result's "how this works" expander.

## Considered options
- **Per-decile `/pip` endpoint (10 points):** rejected — too coarse for the upper tail; high earners flatline.
- **2017-PPP percentiles file:** rejected — legacy; mixing a 2017 PPP distribution with a 2026 salary converted at 2021 PPP corrupts ranks.
- **WID.world top-income splice as primary:** rejected for v1 — heavier methodology and a second dataset to reconcile; revisit for v2 top-tail accuracy.
- **OECD square-root household-size adjustment:** rejected for v1 — would require a household-size input, cutting against "extremely minimal"; we chose flattering-and-disclosed instead.
- **Gross→net conversion per country:** rejected — brittle tax modelling; "gross + estimate label" is more honest and far simpler.

## Consequences
- Data is baked to **static JSON** at build time from the PIP percentiles CSV (`world_100bin_revised.csv`, dataset 0063646; OWID GitHub mirror as a stable fallback). Income never touches a server.
- Survey years span 2021–2024 against a 2026 salary; real-terms drift is an accepted, disclosed limitation.
- India 2022 reports a single national *consumption* figure (no urban/rural pooling needed for the latest year); the other Core-5 report *income*. The welfare-type mix is disclosed.
- The data-catalog resource id can change on re-version; the build script must pin the version and fall back to the mirror.
- Adding a household-size input or WID top-tail later is purely additive and would supersede parts of this ADR.
