# Keep OG share images static; do not personalize them to the guess–Gap

The `/r/<bucket>` unfurl image is the highest-*reach* glimpse of a result, and the
most-requested "virality" upgrade is to bake the personalized **Gap** ("off by N
people") into it. We deliberately decline this and keep OG images **static and
path-based per result bucket** (per [ADR-0002](./0002-static-cloudflare-path-based-og.md)).

Why: under the product's **Pull** model the magnet is the on-screen **Money shot**
and the screenshot path, neither of which needs a personalized unfurl; explicit
sharing is unproven ("not that strong"); and a guess-aware image would force either
a dynamic OG renderer (a Cloudflare Worker/adapter that breaks ADR-0002's static,
no-adapter deploy) or a ~99×99 page/image explosion. The cheap win we take instead
is **punchier static per-bucket OG copy** (lead with that bucket's gut-punch
perspective line) — more magnetic, zero architecture change.

Revisit only if shared-link traffic proves to be a real acquisition channel.

## Considered options

1. **Dynamic per-request OG Worker** — rejected: breaks the static, adapter-free
   deploy chosen in ADR-0002.
2. **Pre-baked `result × guess` matrix** (`/r/{result}/{guess}`) — rejected:
   ~9,800 pages/images, a path explosion.
3. **Static per-bucket image, punchier copy** — chosen.
