# Static-first on Cloudflare Workers, with path-based result pages and build-time OG images

The site ships as **Astro `output: 'static'` deployed to Cloudflare Workers Static Assets, with no adapter in v1**. The income calculator is a plain Astro `<script>` (no framework island); all math runs in the browser and income never leaves the device. Result pages are **path-based per global rank** (`/r/7`), statically generated, each embedding its own **build-time-rendered OG PNG** (`top-7.png`). Local context (`?c=IN&l=62`) is layered in client-side and never affects the crawler-visible `og:image`.

This shape is chosen because a purely static page cannot vary its `og:image` by query string — crawlers hit one HTML file — so a *personalized* unfurl requires either path-based pages or a runtime endpoint. The runtime path needs the `@astrojs/cloudflare` adapter **and** the Workers paid plan (the free tier's 10 ms CPU cannot run satori+resvg per request). Pre-rendering ~99 `top-N.png` cards at build time delivers the personalized "global top 7%" unfurl on the **free tier** with no adapter and no runtime cost.

## Considered options
- **Cloudflare Pages:** rejected — the `@astrojs/cloudflare` adapter dropped Pages support; Astro + Cloudflare steer new projects to Workers.
- **`output: 'server'` + per-page `prerender = true`:** rejected — makes every page on-demand by default and ships a Worker invocation for the static shell; the inverse of what we want.
- **Runtime OG endpoint (adapter + paid plan):** rejected for v1 — flexible (exact per-result cards) but costs ~$5/mo and adds the adapter and workerd-based dev now. It remains the clean v2 upgrade: keep `output: 'static'`, add the adapter, mark only the OG route `prerender = false`.
- **Single generic OG card:** rejected — free and trivial, but every shared link looks identical and loses the personal-number brag, weakening the viral loop.
- **Client `<canvas>` as the only share path:** rejected for unfurls — social crawlers don't run JS, so a canvas image never appears in a preview. Canvas is kept *only* for the user-initiated in-app "share my card".

## Consequences
- v1 needs **no adapter and no `compatibility_flags`**; `wrangler.jsonc` just points `assets` at `./dist`. The custom domain `incomerank.jass.gg` is bound via a `custom_domain` route (jass.gg is an active Cloudflare zone).
- Adding the runtime OG endpoint later is additive (adapter + one `prerender = false` route) and does not repaint the static shell.
- Build time grows by the OG pre-render step (~99 small PNGs via satori + native `@resvg/resvg-js` in a Node build script).
