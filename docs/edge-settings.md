# Edge settings

Optional but recommended once the app runs on your own domain ([Production deployment](./deployment.md), step 5). These are **zone-level** settings: they apply to traffic through your zone's hostnames (`<domain>`, and `data.<domain>` if it serves the data). Edge caching keeps Function CPU, the free plan's tightest limit, low as traffic grows.

## Cache Rules

Caching > Cache Rules. Functions set their own `Cache-Control` per endpoint; these rules make that JSON cacheable at the edge, so most client polls are answered without running a Function. Create them in this order:

| # | Name | Match | Settings |
| - | ---- | ----- | -------- |
| 1 | api cache | URI Path starts with `/api` | Eligible for cache; Edge TTL: **Use cache-control header if present** (respect origin). Leave Browser TTL alone. |
| 2 | data cache (only for self-hosted data on your zone) | Hostname equals `data.<domain>` | Eligible for cache; Edge TTL **override, 5 h** (18000 s); Browser TTL **override, 5 h**; Serve stale content while revalidating **on**. |
| 3 | sitemap | URI Path wildcard `/sitemap.xml` | Eligible for cache; Edge TTL and Browser TTL **respect origin**; Serve stale content while revalidating **on**. |

- Rule 1 must respect origin: TTLs differ per endpoint (10 s for live feeds, longer for static data), and uncacheable answers use `max-age=0` or `no-store`. `/api/admin/*` sends `private, no-store`, so it is never cached despite matching.
- Rule 2's 5 h TTL bounds how long a data rebuild takes to reach users. It overrides the origin because GitHub Pages sends only a 10-minute `max-age`.
- Turn on **Tiered Cache** with Smart Topology (Caching > Tiered Cache), so cache misses across data centers collapse into one upstream fetch.

**Check:** run `curl -sI https://<domain>/api/cities` twice; the second response has `cf-cache-status: HIT`.

## Rate limiting

Security > Security rules. The free plan allows one rule.

| Name | Match | Counting | Limit | Action |
| ---- | ----- | -------- | ----- | ------ |
| api rate limit | URI Path wildcard `/api/*` **or** URI Path wildcard `/mcp` | per IP, per data center (`ip.src`, `cf.colo.id`) | 40 requests / 10 s | Block for 10 s |

It catches scrapers and runaway clients; the app's own polling stays well below it.

## Redirects

Account level: Bulk Redirects.

- `www.<domain>` → `https://<domain>`. `www` needs a proxied placeholder DNS record (e.g. `A 192.0.2.1`) so the redirect can fire.
- `<project>.pages.dev` → `https://<domain>`, so all traffic goes through the zone rules above.

Use 301 and enable *preserve query string*, *subpath matching* and *preserve path suffix*, so deep links keep their path.

## Other settings (as we run them)

- **SSL/TLS**: Full; Always Use HTTPS on; HTTP/3 and 0-RTT on.
- **Bots**: Bot Fight Mode on, with Cloudflare-managed `robots.txt`.
- **Web Analytics**: enable it in one place, either for the zone (automatic injection) or in the Pages project; both together count each page view twice.
- **Speed** (Speed > Optimization): Rocket Loader, Early Hints and Brotli on; Polish and Mirage off. Rocket Loader rewrites the page's `<script>` tags to defer them, so if the app or PWA boot misbehaves on `<domain>` but not on `pages.dev`, turn it off first.
