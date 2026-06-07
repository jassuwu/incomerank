# UX & screen-architecture analysis

A first-principles review of the app's screens and viral flow. Produced from a
multi-agent analysis (product-essence, screen-by-screen audit, virality, and
alternative architectures) and condensed here so the calls that need a human can
be made on the PR.

> **What this branch already shipped** (so this doc is "what's left"):
> the redesigned post-guess reveal — one unambiguous ascent that lands on the
> truth and never leaves it (the confusing 4-stage round-trip is gone), distinct
> labeled markers for **you / guess / Elon**, the home-country rank under the
> hero, a decluttered odometer + floors, and the wider guess window. The biggest
> *animation* friction this analysis flagged (the redundant down-and-back gap
> trip) is therefore **done**. Everything below is the **layout / product /
> virality** layer, which is mostly judgment calls left for you.

## Thesis

Income Rank is not a calculator — it's a **virality engine** whose real product
is the screenshot/link that makes a friend check their own number. Judge every
screen by two things: how fast it reaches the payoff, and how cleanly it loops
back out into a share.

The 3-screen model (**INPUT → GUESS → REVEAL**) is structurally correct. Don't
merge it into one continuous scroll (that dilutes the punctuated "doors open"
climax) and don't blow it up into more screens. The real disease is that
**Screen 3 does the work of five screens stacked vertically**, while the two
things that actually grow the product — the landed rank and the share button —
are buried at the bottom. The fix is **reordering and decongestion, not a
rewrite**. Keep what's loved: the shaft graph, the casino ratchet, the elevator
ascent, the doors-open thunk.

## Recommended architecture

Keep 3 conceptual screens, **re-weighted** — INPUT → GUESS (optional) → REVEAL —
and formally treat **`/r/<bucket>` as the 4th "front door"** for everyone who
arrives via a shared link. The decisive restructure is *inside* Screen 3: split
the bloated settled reveal into

- a tight **climax spine** — landed `global top X%` → guess-gap line → "keep
  going to Elon" → **SHARE**, all within a thumb's reach of the landing — and
- a clearly-secondary **"go deeper" zone** below the share fold (explore slider,
  perspectives list, where-you'd-be-rich, sources/method).

The core loop *see → try → share* must never be gated by exploration UI.

## Per-screen actions

### Screen 1 — INPUT (`#calc`)
- **Keep:** the three inputs (amount, period, country) — the genuine minimum;
  autofocus + submit-on-Enter; auto-detected currency/country + persisted prefs;
  the single primary CTA.
- **Change:** demote the 165-item country `<select>` to a small inline
  "in 🇺🇸 United States — change" affordance that expands only on tap; make
  period + country visually subordinate so the eye goes amount → button; shrink
  the footer so it doesn't compete for the first impression.
- **Add:** one line of **stakes + privacy** under the headline
  ("most people are way richer globally than they feel — and your income never
  leaves this device"). Cold homepage visitors get zero hook today, and the
  privacy promise (a core differentiator) is invisible until the method blurb.
- **Cut:** nothing — this screen is already lean.

### Screen 2 — GUESS (`#reveal.guessing`)
- **Keep:** the whole mechanic — the draggable `role=slider` puck, keyboard
  support, the live "me? top X%" label, the inviting bob, the rising scrub
  ticks, and isolating it on its own no-scroll screen with YOU hidden. This is
  the most original idea in the product and the engine of the share card.
- **Change:** consider starting the puck near the user's **country median**
  instead of dead-center, so the surprise sharpens to the thesis ("you thought
  local, you're actually global"); make the bet read as a deliberate game, not a
  stall (Screen 1 promises "find my rank →", Screen 2 silently becomes "guess
  first").
- **Add:** an always-visible **"just show me →" skip** (wired to the existing
  `skipToYou`) so the guess is a *choosable bet*, not a toll gate; a tiny
  "↑ richer / poorer ↓" altitude legend so the first bet is informed.
- **Cut:** nothing is junk — only the two-step friction before payoff.

### Screen 3 — REVEAL (`#reveal` settled)
- **Keep:** the ASCENT cinematic; the guess-gap line; the keep-going-to-Elon
  climb; the privacy-safe card strategy; the sources/method `<details>`.
- **Change:** **reorder so the spine surfaces first** — landed headline → gap
  line → **SHARE** → Elon lure, with the dense content staggering below the
  fold. Today SHARE is dead last (after gap + explore + persp + where + method);
  surfacing it at the gap-detonation moment is the single highest-leverage
  change in the app. Promote the Elon climb to fire right after the gap (many
  never see it). Make the landed rank a big *persistent* headline so silent
  screenshots still carry the number.
- **Cut / demote into "go deeper":** the **explore what-if slider** (a
  calculator affordance in "a reveal machine, not a calculator", the heaviest
  state/rebuild source, almost never shared); the full 19-country
  **where-you'd-be-rich** list (keep only the one-line "top 1% in N of M
  countries"); most of the 5-bullet **perspectives** list (keep the rotating
  pull-quote).
- **Add:** a SHARE affordance *at* the gap-detonation moment; **one-tap share**
  (build the card blob eagerly during the ride, then fire `navigator.share`
  immediately — today it's two taps); a **9:16 Stories** card variant; a
  "challenge a friend to beat your gap" framing.

### Front door — `/r/<bucket>`
- **Keep:** the big rank headline, the real tower visual, the client-side
  guess-gap dare, the "Can you guess yours?" CTA. This page is arguably
  better-structured than the cold homepage.
- **Change:** punchier first-viewport hook; make the CTA a high-contrast primary
  **button** at first paint; pre-fill the visitor's detected country.
- **Considered & deferred:** personalizing the **OG unfurl image** to the Gap
  (`/og/top-<b>.png` is static per bucket; the "off by N people" dare lives only
  in client JS, so the unfurl shows the blandest version). The fix is real but
  was rejected for now — see the decision below and
  [ADR-0004](./adr/0004-static-og-no-guess-personalization.md). The kept move is
  punchier *static* copy. (Landing receivers straight into **guess mode** remains
  an open option, not yet decided.)

## Decisions (locked 2026-06-07)

North star is **Pull** — desire-to-try on sight, not an engineered share funnel
(see `CONTEXT.md`). Every call below was judged by it.

**Guess — kept, mandatory and frictionless.**
- Bet by drag-or-tap with **release-to-lock** (a slingshot); the rising-pitch
  scrub is preserved on drag; the separate "lock it in" button is dropped as a
  *required* step (kept small as a hint + keyboard Enter); a ~600ms
  "locking… (grab to adjust)" grace guards stray taps; **no confirm tap.**
- The puck **starts at the global median (top 50%)** — an honest neutral anchor.
  Country-median anchoring was rejected as too manipulative for *this* product.
- *Rejected:* a "just show me →" skip — we keep betting mandatory (so every
  result carries a **Gap**) and remove the friction instead of offering an escape.

**Reveal — split into Money shot + Go deeper** (both in `CONTEXT.md`).
- **Money shot** (one screenshot-clean viewport): Global rank + Local rank +
  the shaft with YOU/GUESS marks + the **Gap** line + the rotating pull-quote +
  the keep-going lure + one simple save/share + a one-line **Estimate** disclaimer.
- **Cut entirely:** the explore what-if slider (off-mission, never shared, heavy
  state — `sliderToDaily`/`dailyToSlider`/`setExplore`/`rafPending`).
- **Demote to Go deeper:** where-you'd-be-rich (keep its one-liner as the header),
  the 5-bullet perspectives list, and the sources/method prose (trim to ~2
  sentences; keep the table + source links).
- **Keep in the Money shot:** the rotating pull-quote (the most Pull-magnetic text).
- **Elon climb:** stays a prominent **lure**, fired right after the Gap —
  *no auto-play, no spoiler*.

**Share machinery — simple, not a funnel.**
- One affordance in the Money shot; build the Share card eagerly during the ride;
  tap → preview the card + native share sheet (save-image / copy-link on desktop).
- **Dropped from scope:** the 9:16 Stories card and the challenge-a-friend loop.
- **OG unfurl:** stays static per-bucket, **not** personalized to the Gap —
  see [ADR-0004](./adr/0004-static-og-no-guess-personalization.md). Cheap win:
  punchier static per-bucket OG copy.

**Input — keep it lean.**
- **Add** one non-spoiler stakes + privacy line, e.g. *"find out where your income
  really ranks among everyone alive — your number never leaves this device."*
- **Do NOT demote the country/currency selector.** It is *currency*-load-bearing:
  the user enters their **local** currency, and the app must never make them
  hand-convert to USD. It stays prominent and easy.

## Virality priorities (ranked)

1. Personalize the OG unfurl image to the guess gap (biggest single K-factor
   leak — the crawler thumbnail is the generic percentile today).
2. Surface SHARE at the gap-detonation climax and collapse it to one tap.
3. Add a 9:16 Stories-native card + share-to-Stories path.
4. Make the guess skippable + keep the cinematic ≤ ~3s to the headline.
5. An explicit challenge-a-friend dare loop that lands receivers in guess mode.
6. Put the real tower geometry on the user share card + a normative
   social-proof line ("most people guess 30 too low").

## Suggested sequencing

- **Phase 1 — rides this branch's reveal redesign (highest ROI, near-zero new
  code):** ✅ the gap round-trip is already removed. Remaining: reorder
  `finishReveal()`/`staggerLines()` so the spine (headline → gap → Elon lure →
  SHARE) is above the fold; collapse share to one tap by building the card blob
  eagerly during the ride.
- **Phase 2 — cheap decongestion:** the "just show me →" skip; inline country
  affordance; INPUT stakes+privacy line; cut/demote the explore slider + where
  list; trim perspectives + method.
- **Phase 3 — the virality engine (larger, highest reach):** personalized
  guess-gap OG images; the 9:16 Stories card; the challenge-a-friend loop that
  lands receivers into guess mode.
