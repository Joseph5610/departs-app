# Production Deployment Guide

Step-by-step setup of a full departs deployment from scratch. The steps are written in the order they must happen; where a step can be verified, it ends with a **Check** to run before moving on.

## Overview

A deployment is two repositories and one Cloudflare account:

| Part | Repository | Hosted on | Serves |
| ---- | ---------- | --------- | ------ |
| Static data | [`departs-data`](https://github.com/Joseph5610/departs-data) | GitHub Pages, `data` branch | Pre-built timetable, stop and shape JSON per network, publicly at `https://data.departs.app` |
| App | `departs-app` (this repo) | Cloudflare Pages + Pages Functions | The PWA and `/api/*`, `/mcp`, `/sitemap.xml` |

The app does not parse GTFS at runtime. Scheduled GitHub Actions in `departs-data` download each network's timetables, cut them into small JSON chunks, and force-push them to the `data` branch. The browser and the Pages Functions then fetch only the chunks they need. Live positions and departures come from each network's realtime API, called by the Functions. The app shows no stops or schedules without this data, so step 1 decides where it comes from.

### Placeholders

| Placeholder | Meaning | Example (ours) |
| ----------- | ------- | -------------- |
| `<domain>` | Custom domain for the app | `departs.app` |
| `<data-host>` | Base URL of the static data; only differs from ours if you self-host | `https://data.departs.app` |
| `<project>` | Cloudflare Pages project name, served at `<project>.pages.dev` | `departs-app` |

### What you need

- A Cloudflare account (the free plan is enough).
- A GitHub account.
- A Golemio API key, from [api.golemio.cz](https://api.golemio.cz/api-keys/), if you serve Prague (its realtime data).
- Optional: a domain with DNS on Cloudflare. Without one, the app runs on `<project>.pages.dev` and steps 5 and 7 do not apply.

## 1. Choose the data source

**Default: use ours.** The app is already configured to read `https://data.departs.app`, which is public, rebuilt daily, and published under CC BY 4.0 (credit the sources as listed in the [`departs-data` README](https://github.com/Joseph5610/departs-data#-license)). Nothing to do; go to step 2.

**Self-host** if you need your own schedule, networks or availability. Follow the [`departs-data` repository](https://github.com/Joseph5610/departs-data): its GitHub Actions build the data on a schedule and publish it to GitHub Pages, so a fork can serve it as-is, or you can run the build scripts and host the output anywhere static. If you have a domain on Cloudflare, you can optionally serve the data through it (e.g. a proxied `data.<domain>`) to get edge caching from step 7.

**Check:** `curl -sI <data-host>/<city>/map-stops.json` returns `200` for each network you build, where `<city>` is the folder name the build publishes (e.g. `prague`).

## 2. Fork the app and set your hostnames

Fork this repository; Cloudflare Pages builds from your fork in step 4. Our hostnames are hard-coded, so replace the app's production URL (`https://<domain>`, or `https://<project>.pages.dev` without a custom domain) in:

| File | What |
| ---- | ---- |
| `src/config/site.ts` | `URL` (and `NAME` to rename the app); the build fills both into `index.html`, `robots.txt`, `llms.txt`, `.well-known/` and the 404 page |
| `functions/_core/config.ts` | `SITE_URL` (the MCP server's advertised endpoint) |

The API accepts browser requests only from the host that serves it (plus `localhost`), so no origin list needs editing.

Only if you self-host the data, also replace `https://data.departs.app` in:

| File | What |
| ---- | ---- |
| `src/config/site.ts` | `STATIC_DATA_URL`; the build fills it into the CSP in `_headers` and into `_redirects` |
| `functions/_core/config.ts` | `STATIC_DATA_URL` |

## 3. Create Cloudflare resources

1. **KV namespace** (Storage & Databases > KV): create one, e.g. `departs`. It stores user feedback. Note its ID.
2. **Turnstile widget** (Turnstile > Add widget), mode *Managed*. Hostnames: every production host (`<domain>` and/or `<project>.pages.dev`), plus any preview hostnames where the feedback form must work. Note the site key and secret key.

## 4. Create the Pages project

1. Workers & Pages > Create > Pages > **Connect to Git**, and pick your fork from step 2.
2. Build settings:
   - Production branch: `master`
   - Build command: `npm run build`
   - Build output directory: `dist`
3. Settings > Variables and Secrets, for **both Production and Preview**:

   | Name | Type | Value |
   | ---- | ---- | ----- |
   | `GOLEMIO_API_KEY` | Secret | Golemio API key |
   | `TURNSTILE_SECRET_KEY` | Secret | Turnstile secret key |
   | `VITE_TURNSTILE_SITE_KEY` | Plain text or secret | Turnstile site key; read at **build** time, so redeploy after changing it |

4. Settings > Bindings: add a **KV namespace** binding named `FEEDBACK_STORE` pointing to the namespace from step 3, for both environments.
5. Settings > Runtime: set the compatibility date to match `compatibility_date` in `wrangler.toml`.
6. Trigger a deployment (push to `master` or *Retry deployment*).

`wrangler.toml` is used only by local development (`npm run dev`). It has no `pages_build_output_dir`, so Cloudflare Pages ignores it and the dashboard settings above are what production runs with. Put your KV ID into its `[[kv_namespaces]]` block so local dev uses the same namespace.

**Check:** `https://<project>.pages.dev` loads the map with stops, and `curl -s https://<project>.pages.dev/api/cities` returns JSON.

## 5. Attach the custom domain (optional)

Skip this if you stay on `<project>.pages.dev`.

Pages > `<project>` > Custom domains > *Set up a domain* > `<domain>`. For an apex domain this creates a proxied `CNAME <domain> → <project>.pages.dev` (flattened at the root).

**Check:** `https://<domain>` loads the app.

## 6. Protect the admin hub and previews (Cloudflare Access)

`/admin` and `/api/admin/*` expose user feedback and raw feed diagnostics; preview deployments run unreleased code. In Zero Trust > Access > Applications, create one **self-hosted application** with these destinations:

- `*.<project>.pages.dev`: preview and branch deployments (e.g. `abc123.<project>.pages.dev`). The wildcard does not match production at bare `<project>.pages.dev`.
- `<host>/adm*` and `<host>/adm*/*`: the admin hub.
- `<host>/api/adm*` and `<host>/api/adm*/*`: the admin API.

`<host>` is every hostname that serves production: `<domain>`, plus `<project>.pages.dev` unless it redirects to `<domain>` (step 7). Add one **Allow** policy listing the team members' emails.

**Check:** `https://<host>/admin` in a private window shows the Access login, not the dashboard.

## 7. Configure the zone (optional, recommended)

Everything in this step is **zone-level** configuration, so it only applies to traffic that goes through hostnames in your zone (`<domain>`, and `data.<domain>` if you serve self-hosted data through it). Requests to `*.pages.dev` skip all of it, with no edge caching rules and no rate limiting. That works for a small deployment but costs more Function CPU per user, and the free plan's per-request CPU limit is the first thing a busy deployment hits.

### Cache Rules (Caching > Cache Rules)

Functions set their own `Cache-Control` (`max-age` = `s-maxage` per endpoint, plus `stale-while-revalidate` and `stale-if-error`). Cloudflare does not cache JSON from Pages Functions by default, so these rules make it eligible. Without them every client poll invokes a Function.

Create them in this order:

| # | Name | Match | Settings |
| - | ---- | ----- | -------- |
| 1 | api cache | URI Path starts with `/api` | Eligible for cache; Edge TTL: **Use cache-control header if present** (respect origin). Leave Browser TTL alone. |
| 2 | data cache (only for self-hosted data on your zone) | Hostname equals `data.<domain>` | Eligible for cache; Edge TTL **override, 5 h** (18000 s); Browser TTL **override, 5 h**; Serve stale content while revalidating **on**. |
| 3 | sitemap | URI Path wildcard `/sitemap.xml` | Eligible for cache; Edge TTL and Browser TTL **respect origin**; Serve stale content while revalidating **on**. |

- Rule 1 must respect origin: TTLs differ per endpoint (10 s for live feeds, longer for static data), and uncacheable answers use `max-age=0` or `no-store`. `/api/admin/*` sends `private, no-store`, so it is never cached despite matching.
- Rule 2's 5 h TTL bounds how long a data rebuild takes to reach users. It overrides the origin because GitHub Pages sends only a 10-minute `max-age`.
- Turn on **Tiered Cache** with Smart Topology (Caching > Tiered Cache), so cache misses across data centers collapse into one upstream fetch.

### Rate limiting (Security > Security rules)

The free plan allows one rule.

| Name | Match | Counting | Limit | Action |
| ---- | ----- | -------- | ----- | ------ |
| api rate limit | URI Path wildcard `/api/*` **or** URI Path wildcard `/mcp` | per IP, per data center (`ip.src`, `cf.colo.id`) | 40 requests / 10 s | Block for 10 s |

The app's own polling stays far below this; the limit only catches scrapers and runaway clients.

### Redirects (account level: Bulk Redirects, optional)

- `www.<domain>` → `https://<domain>`. `www` needs a proxied placeholder DNS record (e.g. `A 192.0.2.1`) so the redirect can fire.
- `<project>.pages.dev` → `https://<domain>`, if you want all traffic to go through the zone rules above. Without it, `pages.dev` keeps serving the app with none of them.

Use 301 and enable *preserve query string*, *subpath matching* and *preserve path suffix*, so deep links keep their path.

### Other settings (as we run them)

- **SSL/TLS**: Full; Always Use HTTPS on; HTTP/3 and 0-RTT on.
- **Bots**: Bot Fight Mode on, with Cloudflare-managed `robots.txt`.
- **Web Analytics**: enable it either for the zone (automatic injection) or in the Pages project, not both, or each page view is counted twice.
- **Speed** (Speed > Optimization): Rocket Loader, Early Hints and Brotli on; Polish and Mirage off. Rocket Loader rewrites the page's `<script>` tags to defer them, so if the app or PWA boot misbehaves on `<domain>` but not on `pages.dev`, turn it off first.

**Check:** run `curl -sI https://<domain>/api/cities` twice; the second response has `cf-cache-status: HIT`. If you serve the data through your zone, `curl -sI https://data.<domain>/<city>/map-stops.json` shows `cf-cache-status` (proving the data host is proxied).

## Ongoing operation

- **App:** every push to `master` deploys production; every other branch and pull request gets a preview deployment behind Access.
- **Data (self-hosted):** the workflows rebuild on schedule. To refresh a network immediately, run its workflow by hand; users see the change within the 5 h cache TTL.
- **Adding an API route:** if it is outside `/api/*`, extend the Cache Rule and the rate limit to cover it.
