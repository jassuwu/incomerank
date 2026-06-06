# Income Rank

A minimal microsite that reveals where a person's income places them in the world: their estimated global income percentile, with their within-country rank as supporting context. The product is a reveal machine, not a financial calculator.

## Language

**Income**:
The single number the user enters: their personal **gross** earnings in their local currency, before tax, for a chosen period (per year or per month). Treated as the user's welfare level for ranking purposes.
_Avoid_: salary, take-home, net, wage, earnings

**Welfare level**:
The World Bank PIP measure we rank against — household **per-capita** income or consumption, expressed in international PPP dollars. The distribution we compare an Income against is built from welfare levels, not salaries. The gap between an individual Income and a household-per-capita Welfare level is the reason every result is an Estimate.
_Avoid_: wealth, money, standard of living

**Global rank**:
The user's position in the worldwide distribution of Welfare levels, measured against **every living person on Earth** (children and non-earners included). Expressed as "global top X%". This is the hero of the reveal.
_Avoid_: world score, global percentile (informal), ranking

**Local rank**:
The same position computed within the user's **own country's** population only. Supporting context shown beneath the Global rank, never the hero. Available for any country with World Bank distribution data; where none exists, only the Global rank is shown.
_Avoid_: national rank, home rank, country score

**Core 5**:
The five countries that receive hand-tuned native defaults — currency, annual-vs-monthly period, and locale auto-detection: United States, India, United Kingdom, Germany, Brazil. Every other country is still selectable and rankable, but lands on generic defaults.
_Avoid_: supported countries, launch countries (all countries are supported; only these are polished)

**PPP dollars** (international dollars):
The currency- and price-level-neutral unit that makes incomes comparable across countries, anchored to **2021** US buying power (the World Bank's current PPP base). All ranking happens in this unit.
_Avoid_: USD, dollars (unqualified), real dollars, 2017 PPP (superseded)

**Estimate**:
The deliberate, disclosed framing of every result. Every known bias points upward and we own it rather than correct it: a personal **gross** Income is compared against a **household per-capita** Welfare distribution (no household-size division), much of which is **net/disposable** income, against the **whole living population**, across mismatched survey years (2021–2024) and an under-sampled top tail. We never claim an exact salary rank.
_Avoid_: exact, precise, accurate rank

**Reveal**:
The staged, animated result moment after the user submits — the headline rank counts up, then supporting lines stagger in. The product is built around this beat; it is not a static results screen.
_Avoid_: results page, output, dashboard

**Share card**:
The privacy-safe image a user shares — it carries the Global rank and people-count but never the raw Income. Distinct from the OG image a crawler renders when a result link unfurls, though both depict the same rank.
_Avoid_: social image, og image (the share card is user-facing; the OG image is the crawler artifact)
