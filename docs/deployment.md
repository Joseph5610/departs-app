# Production deployment

Set up your own departs.app from scratch. Follow the steps in order; a step that can be verified ends with a **Check**. Then add [Ride push](./ride-push-deployment.md) for notifications and the [Edge settings](./edge-settings.md) for caching and rate limiting.

## Overview

A deployment is two repositories and one Cloudflare account:

| Part | Repository | Hosted on | Serves |
| ---- | ---------- | --------- | ------ |
| Static data | [`departs-data`](https://github.com/Joseph5610/departs-data) | GitHub Pages, `data` branch | Pre-built timetable, stop and shape JSON per network, publicly at `https://data.departs.app` |
| App | `departs-app` (this repo) | Cloudflare Pages + Pages Functions | The PWA and `/api/*`, `/mcp`, `/sitemap.xml` |
| Ride push (optional) | `departs-app`, `workers/ride-push/` | Cloudflare Worker + Durable Objects | Web Push alerts for ride mode ([Ride push deployment](./ride-push-deployment.md)) |

Scheduled GitHub Actions in `departs-data` download each network's timetables, cut them into small JSON chunks, and force-push them to the `data` branch. The browser and the Pages Functions then fetch only the chunks they need. Live positions and departures come from each network's realtime API, called by the Functions.

### Placeholders

| Placeholder | Meaning | Example (ours) |
| ----------- | ------- | -------------- |
| `<domain>` | Custom domain for the app | `departs.app` |
| `<project>` | Cloudflare Pages project name, served at `<project>.pages.dev` | `departs-app` |
| `<host>` | Every hostname that serves production: `<domain>`, plus `<project>.pages.dev` unless it redirects to `<domain>` | `departs.app` |

### What you need

- A Cloudflare account (free plan) and a GitHub account.
- A Golemio API key from [api.golemio.cz](https://api.golemio.cz/api-keys/), for Prague's realtime data.
- Optional: a domain with DNS on Cloudflare.

## 1. Choose the data source

**Default: use ours.** `https://data.departs.app` is public, rebuilt daily and published under CC BY 4.0. Credit the sources as the [`departs-data` README](https://github.com/Joseph5610/departs-data#-license) lists them, then go to step 2.

**Self-host** if you need your own schedule, networks or availability. Fork the [`departs-data` repository](https://github.com/Joseph5610/departs-data): its GitHub Actions build the data on a schedule and publish it to GitHub Pages. You can also run the build scripts yourself and host the output on any static host. With a domain on Cloudflare, serve the data through a proxied `data.<domain>` to get the edge caching from the [Edge settings](./edge-settings.md#cache-rules).

**Check:** `curl -sI <data URL>/<city>/stops.json` returns `200` for each network you build, where `<city>` is the folder name the build publishes (e.g. `prague`).

## 2. Fork the app and set your site

Fork this repository; Cloudflare Pages builds from your fork in step 4. Every hostname and address the app, the Functions and the ride-push Worker use lives in one file, **`shared/site.ts`**:

| Field | Set it to |
| ----- | --------- |
| `URL` | `https://<domain>`, or `https://<project>.pages.dev` without a custom domain |
| `NAME`, `INSTALL_NAME`, `INSTALL_SHORT_NAME`, `TITLE` | Your app's name, if you rename it |
| `CONTACT_EMAIL` | Your contact address: shown in the legal pages and sent with every push |
| `STATIC_DATA_URL` | Your data URL, only if you self-host the data (step 1) |
| `OPERATOR` | The data controller named in the privacy policy |

The build fills these into `index.html`, `robots.txt`, `llms.txt`, `.well-known/`, the CSP in `_headers` and the 404 page. `VAPID_PUBLIC_KEY` is set by [Ride push deployment](./ride-push-deployment.md#1-vapid-keys).

## 3. Create Cloudflare resources

1. **KV namespace** (Storage & Databases > KV): create one, e.g. `departs`. It stores user feedback. Put its ID into the `[[kv_namespaces]]` block of `wrangler.toml`, so local development uses it too.
2. **Turnstile widget** (Turnstile > Add widget), mode *Managed*. Hostnames: every `<host>`, plus any preview hostnames where the feedback form must work. Note the site key and secret key.

## 4. Create the Pages project

1. Workers & Pages > Create > Pages > **Connect to Git**, and pick your fork.
2. Build settings: production branch `master`, build command `npm run build`, output directory `dist`.
3. Settings > Variables and Secrets, for **both Production and Preview**:

   | Name | Type | Value |
   | ---- | ---- | ----- |
   | `GOLEMIO_API_KEY` | Secret | Golemio API key |
   | `TURNSTILE_SECRET_KEY` | Secret | Turnstile secret key |
   | `VITE_TURNSTILE_SITE_KEY` | Plain text | Turnstile site key; read at **build** time, so redeploy after changing it |

4. Settings > Bindings: add a **KV namespace** binding named `FEEDBACK_STORE` pointing to the namespace from step 3, for both environments.
5. Settings > Runtime: set the compatibility date to `compatibility_date` from `wrangler.toml`.
6. Trigger a deployment (push to `master` or *Retry deployment*).

Production runs with these dashboard settings; `wrangler.toml` configures only local development.

**Check:** `https://<project>.pages.dev` loads the map with stops, and `curl -s https://<project>.pages.dev/api/cities` returns JSON.

## 5. Attach the custom domain (optional)

Pages > `<project>` > Custom domains > *Set up a domain* > `<domain>`. For an apex domain this creates a proxied `CNAME <domain> → <project>.pages.dev`.

**Check:** `https://<domain>` loads the app.

## 6. Protect the admin hub and previews (Cloudflare Access)

`/admin` and `/api/admin/*` expose user feedback and raw feed diagnostics; preview deployments run unreleased code. In Zero Trust > Access > Applications, create one **self-hosted application** with these destinations:

- `*.<project>.pages.dev`: preview and branch deployments (e.g. `abc123.<project>.pages.dev`). Production at the bare `<project>.pages.dev` stays public.
- `<host>/adm*` and `<host>/adm*/*`: the admin hub.
- `<host>/api/adm*` and `<host>/api/adm*/*`: the admin API.

Add one **Allow** policy listing the team members' emails.

**Check:** `https://<host>/admin` in a private window shows the Access login, not the dashboard.

## Ongoing operation

- **App:** every push to `master` deploys production; every other branch and pull request gets a preview deployment behind Access.
- **Data (self-hosted):** the workflows rebuild on schedule. To refresh a network immediately, run its workflow by hand; users see the change within the data cache TTL.
- **Adding an API route:** if it is outside `/api/*`, extend the [Cache Rule and the rate limit](./edge-settings.md) to cover it.

## Next steps

- [Ride push deployment](./ride-push-deployment.md): Web Push for My trips and disruptions.
- [Edge settings](./edge-settings.md): caching, rate limiting and redirects on your zone.
