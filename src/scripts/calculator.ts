import world from "../data/world.json";
import type { CountryData, Mode, WorldData } from "../lib/types";
import { parseAmount, currencySymbol, formatCurrency } from "../lib/format";
import { computeReveal, formatTopPercent, type RevealData } from "../lib/rank-copy";
import { buildPerspectives } from "../lib/perspectives";
import { whereYoudRank } from "../lib/where";
import { buildTower, towerBody, camYFor, worldY, incomeAtF, fracBelow, DECADE, VIEW_W, VIEW_H, GUESS_VIEW_H, TOWER_PEAK_DAILY, type Tower, type TowerColors } from "../lib/tower";
import { initSoundPref, ensureAudio, tick, land, soundEnabled, setSoundEnabled } from "../lib/sound";

const W = world as unknown as WorldData;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const form = $<HTMLFormElement>("calc");
const reveal = $<HTMLElement>("reveal");
const amountEl = $<HTMLInputElement>("amount");
const periodEl = $<HTMLSelectElement>("period");
const countryEl = $<HTMLSelectElement>("country");
const curEl = $<HTMLSpanElement>("cur");
const errEl = $<HTMLParagraphElement>("err");
const fieldEl = $<HTMLElement>("field");
const ascentEl = $<HTMLElement>("ascent");
const heroLineEl = $<HTMLElement>("hero-line");
const revealEyebrowEl = $<HTMLElement>("reveal-eyebrow");
const odoNumEl = $<HTMLElement>("odo-num");
const odoLabEl = $<HTMLElement>("odo-lab");
const guessUiEl = $<HTMLElement>("guess-ui");
const guessPuckEl = $<HTMLElement>("guess-puck");
const guessLabEl = $<HTMLElement>("guess-lab");
const guessGoEl = $<HTMLButtonElement>("guess-go");
const gapEl = $<HTMLElement>("gap");
const exploreEl = $<HTMLElement>("explore");
const continueUpEl = $<HTMLElement>("continue-up");
const continueBtnEl = $<HTMLButtonElement>("continue-up-btn");
const perspEl = $<HTMLElement>("persp");
const perspListEl = $<HTMLUListElement>("persp-list");
const sliderEl = $<HTMLInputElement>("slider");
const sliderAmtEl = $<HTMLSpanElement>("slider-amt");
const sliderTopEl = $<HTMLSpanElement>("slider-top");
const whereListEl = $<HTMLUListElement>("where-list");
const whereNoteEl = $<HTMLParagraphElement>("where-note");
const whereModeNoteEl = $<HTMLParagraphElement>("where-mode-note");
const soundEl = $<HTMLButtonElement>("sound");

// ── sound toggle (casino ratchet during the ride) ───────────────────────────
initSoundPref();
soundEl.setAttribute("aria-checked", String(soundEnabled()));
soundEl.addEventListener("click", () => {
  const on = !soundEnabled();
  setSoundEnabled(on);
  soundEl.setAttribute("aria-checked", String(on));
  if (on) ensureAudio(); // this click is a gesture — prime + let them hear it
  if (on) tick(0.4);
});

const cache = new Map<string, CountryData>();
let current: CountryData | null = null;
let last: RevealData | null = null;
let curAmount = 0; // the income currently displayed (entered or explored)

// ── persisted preferences ────────────────────────────────────────────────────
const LS = { country: "ir.country", period: "ir.period" };
const lsGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

// market exchange rates everywhere — your income converted to US$ as-is.
const effMode = (): Mode => "nominal";

// ── country loading + locale detection ──────────────────────────────────────
async function loadCountry(iso: string): Promise<CountryData | null> {
  if (cache.has(iso)) return cache.get(iso)!;
  try {
    const c: CountryData = await (await fetch(`/data/countries/${iso}.json`)).json();
    cache.set(iso, c);
    return c;
  } catch {
    return null;
  }
}

function applyCountry(c: CountryData) {
  current = c;
  curEl.textContent = currencySymbol(c.currency);
  periodEl.value = c.period;
}

function detectIso(): string {
  let region = "";
  try {
    region = new Intl.Locale(navigator.language).region ?? "";
  } catch {
    region = (navigator.language.split("-")[1] ?? "").toUpperCase();
  }
  const opt = region ? countryEl.querySelector<HTMLOptionElement>(`option[data-iso2="${region}"]`) : null;
  return opt?.value ?? "USA";
}

async function selectCountry(iso: string) {
  countryEl.value = iso;
  const c = await loadCountry(iso);
  if (c) applyCountry(c);
}

countryEl.addEventListener("change", () => {
  lsSet(LS.country, countryEl.value);
  selectCountry(countryEl.value).then(() => { if (curAmount > 0) refresh(curAmount); });
});
periodEl.addEventListener("change", () => lsSet(LS.period, periodEl.value));

// ── basis toggle (market exchange rate ⇄ purchasing power) ───────────────────
// ── perspectives + where-you'd-be-rich ──────────────────────────────────────
function renderPerspectives(lines: string[]) {
  perspEl.textContent = lines[0] ?? "";
  perspListEl.replaceChildren(
    ...lines.slice(1, 6).map((l) => {
      const li = document.createElement("li");
      li.textContent = l;
      return li;
    }),
  );
}

function renderWhere(amount: number) {
  if (!current) return;
  const { rows, top1Count, total } = whereYoudRank(current, amount, effMode());
  whereListEl.replaceChildren(
    ...rows.map((r) => {
      const li = document.createElement("li");
      li.className = "flex items-center justify-between py-1.5";
      const name = document.createElement("span");
      name.textContent = `${r.flag}  ${r.name}`;
      const top = document.createElement("span");
      top.className = "text-ink";
      top.textContent = `top ${formatTopPercent(r.top)}`;
      li.append(name, top);
      return li;
    }),
  );
  whereModeNoteEl.textContent = "at market exchange rates. your income converted to US$ as-is.";
  whereNoteEl.textContent = `youre top 1% in ${top1Count} of ${total} countries.`;
}

// ── ASCENT: the elevator with no top floor ───────────────────────────────────
const TOWER_C: TowerColors = {
  wall: "var(--color-line)", crowd: "var(--color-ink)", you: "var(--color-accent)",
  rich: "var(--color-muted)", ink: "var(--color-ink)", muted: "var(--color-muted)", guess: "var(--color-ink)",
  paper: "var(--color-paper)",
};
let camSvg: SVGSVGElement | null = null;
let blurEl: Element | null = null; // the feGaussianBlur driven by ride speed
const setBlur = (k: number) => blurEl?.setAttribute("stdDeviation", `0 ${k.toFixed(2)}`);
let tailMode = false; //  odometer/headline switch once we climb above YOU
let phase: "guess" | "ride" | "done" = "guess";
let guessDaily = 0; //    the income the user is pointing at while guessing
let guessTop = 50; //     the locked guess as a global-top %
let guessVy = 0; //       viewBox top during the guess framing
let guessLo = 1; //       poorest guessable income (bottom of the guess window)
let rideId = 0; //        bumped to cancel an in-flight ride (tap-to-skip)
const GUESS_HI = 900; //  richest guessable income ($/day) — top of the window
const TICK_NOTCH = 11; //  world-units between ratchet ticks during the ride
const SCRUB_NOTCH = 7; //  world-units between ticks while dragging a slider/puck
let lastTickY = NaN; //    last income (worldY) that fired a scrub tick

/** Tick as a slider/puck crosses notches; pitch rises as income rises. */
function scrubTick(daily: number) {
  const wy = worldY(daily);
  if (!Number.isNaN(lastTickY) && Math.abs(wy - lastTickY) < SCRUB_NOTCH) return;
  lastTickY = wy;
  const freq = Math.max(680, Math.min(2300, 760 + 235 * Math.log10(Math.max(daily, 1))));
  tick(0.2, freq);
}

const cdfFor = (): [number, number][] => W.cdfNom as [number, number][];
const fmtPeople = (n: number) => Math.round(Math.max(0, n)).toLocaleString("en-US");
const topAt = (income: number) => (1 - fracBelow(cdfFor(), income)) * 100;
const fmtMult = (m: number) =>
  m >= 1e6 ? `${(m / 1e6).toFixed(m >= 1e7 ? 0 : 1)}M×` : m >= 1000 ? `${Math.round(m / 1000)}k×` : m >= 10 ? `${Math.round(m)}×` : `${m.toFixed(1)}×`;

/** The user's income as market-FX US$ per day. */
function dailyOf(amount: number): number {
  if (!current) return 0;
  const annual = current.period === "monthly" ? amount * 12 : amount;
  return annual / 365 / (current.fx ?? current.ppp2021);
}

/** (Re)build the shaft SVG. YOU + odometer live in the fixed car overlay (HTML). */
function renderTower(youDaily: number, guessDaily?: number) {
  const t: Tower = buildTower(cdfFor(), youDaily, W.worldPopulation, 3200);
  fieldEl.innerHTML =
    // slice (not meet): the shaft box is ~2px narrower than the viewBox (the .shaft
    // borders), so meet letterboxes vertically and "54% of the box" drifts ~1.4px off
    // "54% of the viewBox" — i.e. the car never quite lands on a floor line. slice
    // height-fits exactly (box is always ≤ viewBox aspect), so container-fraction maps
    // 1:1 to viewBox-y. That's also what the puck/pointer math assumes. Only dead
    // horizontal margin (beyond the ±80 walls) gets cropped.
    `<svg viewBox="${-VIEW_W / 2} ${camYFor(youDaily)} ${VIEW_W} ${VIEW_H}" preserveAspectRatio="xMidYMid slice">` +
    `${towerBody(t, TOWER_C, { live: true, hideYou: true, guessDaily })}</svg>`;
  camSvg = fieldEl.querySelector("svg");
  blurEl = fieldEl.querySelector("#vblur-b");
}

function setCam(income: number) {
  camSvg?.setAttribute("viewBox", `${-VIEW_W / 2} ${camYFor(income)} ${VIEW_W} ${VIEW_H}`);
}

function setOdo(income: number) {
  if (tailMode) {
    odoNumEl.textContent = fmtMult(income / Math.max(dailyOf(curAmount), 1e-6));
    odoLabEl.textContent = " your income";
  } else {
    odoNumEl.textContent = fmtPeople(W.worldPopulation * fracBelow(cdfFor(), income));
    odoLabEl.textContent = " people below";
  }
}

function setHeadline(income: number) {
  if (tailMode) {
    heroLineEl.innerHTML = `<span class="text-accent tabular">${fmtMult(income / Math.max(dailyOf(curAmount), 1e-6))}</span> your income`;
  } else {
    heroLineEl.innerHTML = `top <span class="text-accent tabular">${formatTopPercent(topAt(income))}</span>`;
  }
}

// accelerate from rest, decelerate to a stop — how an elevator actually moves.
const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeLinear = (x: number) => x; // steady, readable pace (the famous-tail climb)
const BLUR_K = 8; //   motion-blur per unit speed (worldY / ms)
const BLUR_MAX = 4;

/** Animate the car along the log-income axis (the ride). Cancelable via rideId. */
function ride(from: number, to: number, ms: number, onDone: () => void, ease = easeInOutCubic) {
  const myId = ++rideId;
  const lf = Math.log10(Math.max(from, 1e-6)), lt = Math.log10(Math.max(to, 1e-6));
  const t0 = performance.now();
  let prevY = worldY(from);
  let lastNow = t0;
  let notchAcc = 0;
  const step = (now: number) => {
    if (myId !== rideId) return; // superseded (skipped or restarted)
    const p = Math.min(1, (now - t0) / ms);
    const inc = Math.pow(10, lf + (lt - lf) * ease(p));
    const wy = worldY(inc);
    const d = Math.abs(wy - prevY);
    // blur tracks real speed (worldY per ms), so it's identical at 60 or 120 Hz
    // and naturally ramps with the ease — none at rest, most at the fastest moment.
    setBlur(Math.min(BLUR_MAX, (d / Math.max(1, now - lastNow)) * BLUR_K));
    lastNow = now;
    // one ratchet tick per notch of travel → machine-guns fast, slows as it lands
    notchAcc += d;
    let fired = 0;
    while (notchAcc >= TICK_NOTCH && fired < 3) { notchAcc -= TICK_NOTCH; tick(); fired++; }
    if (notchAcc > TICK_NOTCH) notchAcc = TICK_NOTCH; // drop backlog at peak speed
    prevY = wy;
    setCam(inc); setOdo(inc); setHeadline(inc);
    if (p < 1) requestAnimationFrame(step);
    else { setBlur(0); setCam(to); setOdo(to); setHeadline(to); onDone(); }
  };
  requestAnimationFrame(step);
}

function staggerLines() {
  reveal.querySelectorAll<HTMLElement>(".rline").forEach((el, i) => {
    el.style.transitionDelay = reduceMotion ? "0s" : `${0.09 * i}s`;
  });
  reveal.classList.add("show");
}

// ── explore slider (what-if your income) — all in market-FX US$/day ───────────
const D_MIN = 0.3, D_MAX = 8000;
const sliderToDaily = (v: number) => D_MIN * Math.pow(D_MAX / D_MIN, v / 1000);
const dailyToSlider = (d: number) =>
  Math.max(0, Math.min(1000, Math.round((1000 * Math.log(d / D_MIN)) / Math.log(D_MAX / D_MIN))));

function sliderIncome(v: number): number {
  if (!current) return 0;
  // invert dailyOf: slider position → market-FX daily → local-currency income
  const annual = sliderToDaily(v) * 365 * (current.fx ?? current.ppp2021);
  return current.period === "monthly" ? annual / 12 : annual;
}

/** Live what-if: pan the car to a new income, recompute headline + odometer. */
function setExplore(income: number) {
  if (!current) return;
  tailMode = false;
  setBlur(0);
  const d = dailyOf(income);
  setCam(d); setOdo(d); setHeadline(d); scrubTick(d);
  revealEyebrowEl.textContent = "you'd be in the global";
  sliderTopEl.textContent = `global top ${formatTopPercent(topAt(d))}`;
  sliderAmtEl.textContent = `${formatCurrency(income, current.currency)}/${current.period === "monthly" ? "mo" : "yr"}`;
}

let rafPending = false;
sliderEl.addEventListener("input", () => {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    setExplore(sliderIncome(+sliderEl.value));
  });
});
sliderEl.addEventListener("change", () => refresh(sliderIncome(+sliderEl.value)));
sliderEl.addEventListener("pointerdown", () => { ensureAudio(); lastTickY = NaN; });

// ── recompute everything (rebuild tower) — slider release, PPP/country toggles ─
function refresh(amount: number) {
  if (!current) return;
  curAmount = amount;
  tailMode = false;
  last = computeReveal(W, current, amount, effMode());
  renderPerspectives(buildPerspectives(W, current, amount, last, effMode()));
  renderWhere(amount);
  const d = dailyOf(amount);
  renderTower(d);
  setCam(d); setOdo(d); setHeadline(d);
  sliderEl.value = String(dailyToSlider(d));
  sliderTopEl.textContent = `global top ${formatTopPercent(last.globalTop)}`;
  sliderAmtEl.textContent = `${formatCurrency(amount, current.currency)}/${current.period === "monthly" ? "mo" : "yr"}`;
}

// ── the guess (the bet): drag yourself up the tower ──────────────────────────
/** Pointer Y (screen) → income, within the fixed guess framing. */
function pointerToDaily(clientY: number): number {
  const rect = fieldEl.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
  const d = Math.pow(10, -(guessVy + pct * GUESS_VIEW_H) / DECADE);
  return Math.max(guessLo, Math.min(GUESS_HI, d));
}

/** Place the puck + label at a guessed income. */
function setGuess(daily: number) {
  guessDaily = daily;
  const pct = (worldY(daily) - guessVy) / GUESS_VIEW_H;
  guessPuckEl.style.top = `${(pct * 100).toFixed(2)}%`;
  const top = topAt(daily);
  guessLabEl.textContent = `top ${formatTopPercent(top)}`;
  guessPuckEl.setAttribute("aria-valuenow", String(Math.round(top)));
  guessPuckEl.setAttribute("aria-valuetext", `global top ${formatTopPercent(top)}`);
  scrubTick(daily);
}

let dragging = false;
function onPointerDown(e: PointerEvent) {
  if (phase === "ride") { skipToYou(); return; } // tap skips the cinematic
  if (phase !== "guess") return;
  ensureAudio(); // pointerdown is a gesture → the drag can tick
  dragging = true;
  lastTickY = NaN; // first move ticks immediately
  guessPuckEl.classList.add("touched");
  try { ascentEl.setPointerCapture(e.pointerId); } catch { /* older browsers */ }
  setGuess(pointerToDaily(e.clientY));
  e.preventDefault();
}
function onPointerMove(e: PointerEvent) {
  if (dragging && phase === "guess") { setGuess(pointerToDaily(e.clientY)); e.preventDefault(); }
}
function onPointerUp() { dragging = false; }
ascentEl.addEventListener("pointerdown", onPointerDown);
ascentEl.addEventListener("pointermove", onPointerMove);
ascentEl.addEventListener("pointerup", onPointerUp);
ascentEl.addEventListener("pointercancel", onPointerUp);

// keyboard: the puck is a real slider (↑ richer, ↓ poorer, Enter locks)
guessPuckEl.addEventListener("keydown", (e) => {
  if (phase !== "guess") return;
  ensureAudio();
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); startAscent(); return; }
  const cur = topAt(guessDaily);
  let nt = cur;
  if (e.key === "ArrowUp" || e.key === "ArrowRight") nt = Math.max(0.1, cur - 2);
  else if (e.key === "ArrowDown" || e.key === "ArrowLeft") nt = Math.min(99, cur + 2);
  else return;
  e.preventDefault();
  guessPuckEl.classList.add("touched");
  setGuess(Math.max(guessLo, Math.min(GUESS_HI, incomeAtF(cdfFor(), 1 - nt / 100))));
});

guessGoEl.addEventListener("click", () => { ensureAudio(); startAscent(); }); // gesture → audio allowed

// ── the ride + the doors ─────────────────────────────────────────────────────
function startAscent() {
  if (!current || phase !== "guess") return;
  phase = "ride";
  guessTop = topAt(guessDaily);
  ascentEl.classList.remove("guessing");
  reveal.classList.remove("guessing");
  guessUiEl.classList.add("hidden");
  tailMode = false;
  const youDaily = dailyOf(curAmount);
  renderTower(youDaily, guessDaily); // now bake the guess ghost-line into the shaft

  if (reduceMotion) { setCam(youDaily); setOdo(youDaily); setHeadline(youDaily); revealEyebrowEl.textContent = "You're in the global"; finishReveal(); return; }

  const bottom = cdfFor()[0][0];
  setCam(bottom); setOdo(bottom); setHeadline(bottom);
  ascentEl.classList.add("riding");
  revealEyebrowEl.textContent = "ascending…";
  ride(bottom, youDaily, 2800, doorsOpen);
}

/** Tap during the cinematic → jump straight to the settled truth. */
function skipToYou() {
  rideId++; // cancel any in-flight ride
  setBlur(0);
  tailMode = false;
  const youDaily = dailyOf(curAmount);
  ascentEl.classList.remove("riding");
  setCam(youDaily); setOdo(youDaily); setHeadline(youDaily);
  revealEyebrowEl.textContent = "You're in the global";
  finishReveal();
}

function doorsOpen() {
  ascentEl.classList.remove("riding");
  const youDaily = dailyOf(curAmount);
  setCam(youDaily); setOdo(youDaily); setHeadline(youDaily);
  revealEyebrowEl.textContent = "You're in the global";
  if (!reduceMotion) { ascentEl.classList.add("arrived"); setTimeout(() => ascentEl.classList.remove("arrived"), 800); }
  try { navigator.vibrate?.(14); } catch { /* no haptics */ }
  land();
  setTimeout(gapReveal, 950);
}

/** The payoff: travel from the truth down (or up) to the guess and back — the
 *  length of the trip IS how wrong you were — then settle and call it out. */
function gapReveal() {
  if (phase !== "ride") return;
  const youDaily = dailyOf(curAmount);
  const span = Math.abs(worldY(youDaily) - worldY(guessDaily));
  if (span < 10) { finishReveal(); return; } // basically nailed it — skip the trip
  const dur = Math.min(1500, 650 + span * 2);
  revealEyebrowEl.textContent = "and you guessed…";
  ride(youDaily, guessDaily, dur, () => {
    revealEyebrowEl.textContent = `you guessed top ${formatTopPercent(topAt(guessDaily))}`;
    try { navigator.vibrate?.(8); } catch { /* none */ }
    setTimeout(() => {
      if (phase !== "ride") return; // skipped during the hold
      ride(guessDaily, youDaily, dur, () => {
        revealEyebrowEl.textContent = "You're in the global";
        setHeadline(youDaily);
        finishReveal();
      });
    }, 850);
  });
}

function finishReveal() {
  if (phase === "done") return;
  phase = "done";
  showGapText();
  continueUpEl.classList.remove("hidden");
  exploreEl.classList.remove("hidden");
  sliderEl.value = String(dailyToSlider(dailyOf(curAmount)));
  sliderTopEl.textContent = `global top ${formatTopPercent(last!.globalTop)}`;
  sliderAmtEl.textContent = `${formatCurrency(curAmount, current!.currency)}/${current!.period === "monthly" ? "mo" : "yr"}`;
  staggerLines();
}

function showGapText() {
  const actualTop = last!.globalTop;
  const diff = Math.abs(W.worldPopulation * ((1 - actualTop / 100) - (1 - guessTop / 100)));
  gapEl.classList.remove("hidden");
  if (Math.abs(guessTop - actualTop) < 1.5 || diff < 6e6) {
    gapEl.innerHTML = `🎯 you actually nailed it. global <b class="text-ink">top ${formatTopPercent(actualTop)}</b>.`;
  } else {
    const dir = actualTop < guessTop ? "richer" : "poorer";
    gapEl.innerHTML =
      `you guessed <b class="text-ink">top ${formatTopPercent(guessTop)}</b>. youre actually <b class="text-accent">top ${formatTopPercent(actualTop)}</b>. thats <b class="text-ink">${fmtPeople(diff)}</b> people off, way ${dir} than you thought.`;
  }
}

// ── the dare: keep climbing into the tail ────────────────────────────────────
continueBtnEl.addEventListener("click", () => {
  if (!camSvg || tailMode) return;
  tailMode = true;
  continueUpEl.classList.add("hidden");
  revealEyebrowEl.textContent = "flying past everyone…";
  const youDaily = dailyOf(curAmount);
  // a slow, STEADY climb past Shah Rukh Khan, MrBeast, BTS, Ronaldo, Ambani, Bezos… so you can
  // read each one as you pass — linear (no blast-off), ~8.5s up to the ceiling.
  ride(youDaily, TOWER_PEAK_DAILY, 8500, () => {
    revealEyebrowEl.textContent = "and at the top, Elon Musk earns";
  }, easeLinear);
});

function showReveal(r: RevealData, amount: number) {
  curAmount = amount;
  last = r;
  tailMode = false;
  phase = "guess";
  rideId++; // cancel anything in flight
  renderPerspectives(buildPerspectives(W, current!, amount, r, effMode()));
  renderWhere(amount);

  // guess phase: a static shaft framed across the human range; drag to place
  ascentEl.classList.add("guessing");
  reveal.classList.add("guessing");
  ascentEl.classList.remove("riding", "arrived");
  guessPuckEl.classList.remove("touched");
  guessUiEl.classList.remove("hidden");
  exploreEl.classList.add("hidden");
  gapEl.classList.add("hidden");
  continueUpEl.classList.add("hidden");
  revealEyebrowEl.textContent = "Before the doors open…";
  heroLineEl.textContent = "where do you rank?";

  renderTower(dailyOf(amount)); // shaft with YOU hidden — no spoilers
  guessVy = worldY(GUESS_HI); // frame the guess window: $900/day (top ~0.1%) at the top…
  guessLo = Math.pow(10, -(guessVy + GUESS_VIEW_H) / DECADE); // …down to ~$0.5/day (top ~97%)
  camSvg?.setAttribute("viewBox", `${-VIEW_W / 2} ${guessVy} ${VIEW_W} ${GUESS_VIEW_H}`);
  setGuess(Math.pow(10, -(guessVy + GUESS_VIEW_H * 0.5) / DECADE)); // start the puck mid-shaft

  form.classList.add("opacity-0");
  const swap = () => {
    form.hidden = true;
    reveal.classList.remove("hidden");
  };
  reduceMotion ? swap() : setTimeout(swap, 320);
}

function resetToForm() {
  reveal.classList.add("hidden");
  reveal.classList.remove("show", "guessing");
  ascentEl.classList.remove("riding", "arrived", "guessing");
  sharePanelEl.classList.add("hidden");
  rideId++;
  fieldEl.innerHTML = "";
  camSvg = null;
  curAmount = 0;
  tailMode = false;
  phase = "guess";
  perspEl.textContent = "";
  perspListEl.replaceChildren();
  whereListEl.replaceChildren();
  form.hidden = false;
  requestAnimationFrame(() => form.classList.remove("opacity-0"));
  amountEl.focus();
}

// ── submit / share / again ──────────────────────────────────────────────────
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errEl.textContent = "";
  const amount = parseAmount(amountEl.value);
  if (amount === null) {
    errEl.textContent = "type a number first.";
    amountEl.focus();
    return;
  }
  if (!current) current = await loadCountry(countryEl.value);
  if (!current) {
    errEl.textContent = "couldn't load that country, try another one.";
    return;
  }
  last = computeReveal(W, current, amount, effMode());
  showReveal(last, amount);
});

$("again").addEventListener("click", resetToForm);

// ── share: a personalized guess-gap card (postable image + a dare) ───────────
const sharePanelEl = $<HTMLElement>("share-panel");
const shareImgEl = $<HTMLImageElement>("share-img");
let shareBlob: Blob | null = null;
let shareUrl = "";
let shareText = "";

interface ShareData { guessLabel: string; rankLabel: string; diff: string; nailed: boolean; elon: string }

function shareData(): ShareData {
  const actual = last!.globalTop;
  const nailed = Math.abs(guessTop - actual) < 1.5;
  const diffN = Math.abs(W.worldPopulation * ((1 - actual / 100) - (1 - guessTop / 100)));
  return {
    guessLabel: formatTopPercent(guessTop),
    rankLabel: last!.globalTopLabel,
    diff: `${fmtPeople(diffN)} people`,
    nailed,
    elon: `Elon makes ${fmtMult(TOWER_PEAK_DAILY / Math.max(dailyOf(curAmount), 1e-6))} what i do.`,
  };
}

function shareColors() {
  const cs = getComputedStyle(document.documentElement);
  const g = (n: string, f: string) => cs.getPropertyValue(n).trim() || f;
  return { paper: g("--color-paper", "#f4f0e7"), ink: g("--color-ink", "#191512"), accent: g("--color-accent", "#df2f1b"), muted: g("--color-muted", "#6d655b"), line: g("--color-line", "#d8d0c0") };
}

/** Draw the 1080² guess-gap share card on a canvas (income never appears). */
function buildShareCanvas(d: ShareData): HTMLCanvasElement {
  const S = 1080, P = 92, maxW = S - P - 130;
  const cv = document.createElement("canvas");
  cv.width = S; cv.height = S;
  const x = cv.getContext("2d")!;
  const c = shareColors();
  const disp = getComputedStyle(heroLineEl).fontFamily || "Georgia, serif";
  const body = "Inter, system-ui, sans-serif";
  const fit = (t: string, fam: string, w: number | string, size: number, mw: number) => {
    let s = size; for (;;) { x.font = `${w} ${s}px ${fam}`; if (x.measureText(t).width <= mw || s <= 18) break; s -= 3; } return s;
  };
  x.fillStyle = c.paper; x.fillRect(0, 0, S, S);
  x.textBaseline = "alphabetic";

  try { (x as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "1px"; } catch { /* unsupported */ }
  x.fillStyle = c.muted; x.font = `600 30px ${body}`;
  x.fillText("income rank", P, 126);
  try { (x as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px"; } catch { /* unsupported */ }

  let bigY: number;
  if (d.nailed) {
    x.fillStyle = c.muted; x.font = `500 44px ${body}`;
    x.fillText("i actually nailed it.", P, 300);
    bigY = 520;
  } else {
    x.fillStyle = c.muted; x.font = `500 42px ${body}`;
    x.fillText(`i guessed top ${d.guessLabel}.`, P, 296);
    x.fillStyle = c.ink; x.font = `600 50px ${disp}`;
    x.fillText("turns out im", P, 384);
    bigY = 562;
  }

  const bs = fit(`top ${d.rankLabel}`, disp, 800, 208, maxW);
  x.font = `800 ${bs}px ${disp}`;
  const tw = x.measureText("top ").width;
  x.fillStyle = c.ink; x.fillText("top ", P, bigY);
  x.fillStyle = c.accent; x.fillText(d.rankLabel, P + tw, bigY);

  if (!d.nailed) {
    const t = `off by ${d.diff}`;
    x.fillStyle = c.ink; x.font = `600 ${fit(t, body, 600, 46, maxW)}px ${body}`;
    x.fillText(t, P, bigY + 86);
  }

  x.fillStyle = c.muted; x.font = `500 ${fit(d.elon, body, 500, 36, maxW)}px ${body}`;
  x.fillText(d.elon, P, d.nailed ? bigY + 132 : bigY + 168);

  x.strokeStyle = c.line; x.lineWidth = 2;
  x.beginPath(); x.moveTo(P, S - 224); x.lineTo(S - P, S - 224); x.stroke();

  x.fillStyle = c.ink; x.font = `700 48px ${body}`;
  x.fillText("can you guess yours?", P, S - 148);
  x.fillStyle = c.accent; x.font = `700 40px ${body}`;
  x.fillText("incomerank.jass.gg", P, S - 90);

  // a faint shaft on the right edge: you high (accent), guess low (muted)
  const sx = S - 56;
  x.strokeStyle = c.line; x.lineWidth = 4;
  x.beginPath(); x.moveTo(sx, 170); x.lineTo(sx, S - 250); x.stroke();
  x.fillStyle = c.accent; x.beginPath(); x.arc(sx, 248, 13, 0, Math.PI * 2); x.fill();
  if (!d.nailed) { x.fillStyle = c.muted; x.beginPath(); x.arc(sx, S - 330, 9, 0, Math.PI * 2); x.fill(); }

  return cv;
}

const flash = (btn: HTMLElement, msg: string) => { const old = btn.textContent; btn.textContent = msg; setTimeout(() => (btn.textContent = old), 1600); };

$("share").addEventListener("click", async () => {
  if (!last || !current) return;
  ensureAudio(); tick(0.3, 980);
  try { await (document as Document & { fonts?: FontFaceSet }).fonts?.ready; } catch { /* no FontFaceSet */ }
  const d = shareData();
  shareUrl = `${location.origin}/r/${last.globalBucket}?c=${current.iso}&l=${last.localPercentile}&g=${Math.round(guessTop)}`;
  shareText = d.nailed
    ? `nailed it. im global top ${d.rankLabel} by income. can you guess yours?`
    : `i guessed i was global top ${d.guessLabel}. turns out top ${d.rankLabel}, off by ${d.diff}. can you guess yours?`;
  const canvas = buildShareCanvas(d);
  shareImgEl.src = canvas.toDataURL("image/png");
  await new Promise<void>((res) => canvas.toBlob((blob) => { shareBlob = blob; res(); }, "image/png"));
  sharePanelEl.classList.remove("hidden");
  sharePanelEl.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
});

$("share-send").addEventListener("click", async () => {
  const file = shareBlob ? new File([shareBlob], "income-rank.png", { type: "image/png" }) : null;
  try {
    if (file && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text: shareText, url: shareUrl });
    else if (navigator.share) await navigator.share({ text: shareText, url: shareUrl });
    else { await navigator.clipboard.writeText(`${shareText} ${shareUrl}`); flash($("share-send"), "copied ✓"); }
  } catch { /* dismissed */ }
});

$("share-save").addEventListener("click", () => {
  if (!shareImgEl.src) return;
  const a = document.createElement("a");
  a.href = shareImgEl.src; a.download = "income-rank.png"; a.click();
});

$("share-copy").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(`${shareText} ${shareUrl}`); flash($("share-copy"), "copied ✓"); } catch { /* blocked */ }
});

// ── init: restore saved country + period, else detect ───────────────────────
(async () => {
  const saved = lsGet(LS.country);
  const startIso = saved && countryEl.querySelector(`option[value="${saved}"]`) ? saved : detectIso();
  await selectCountry(startIso); // applyCountry sets the period to the country default
  const sp = lsGet(LS.period);
  if (sp === "annual" || sp === "monthly") periodEl.value = sp; // then honour the saved period
})();
