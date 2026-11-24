# Ride push deployment

My trips alerts and disruption notifications reach a locked phone only through Web Push, sent by the `departs-ride-push` Worker. This guide adds it to a deployment that already runs the app ([Production deployment](./deployment.md), steps 1–4). [Push notifications](./ride-notifications.md) explains how it works.

The Worker is optional; without it, My trips alert only while the app is open and the disruption switch fails with a message.

## Why a separate Worker

Each trip, and each city's disruption subscriptions, is watched by a Durable Object, which only a Worker can define. Pages reaches it through a binding, so the Worker's public `workers.dev` address is turned off (`workers_dev = false` and `preview_urls = false` in `workers/ride-push/wrangler.toml`).

| Part | Lives in | Deployed by |
| ---- | -------- | ----------- |
| `/api/<city>/ride` and `/api/<city>/disruptions` endpoints, app, service worker | Pages project | Pages Git integration |
| `RideWatch` and `DisruptionWatch` Durable Objects | `departs-ride-push` Worker | Workers Builds (step 4) |

## 1. VAPID keys

VAPID keys sign every push, so push services know it comes from you. Generate the pair once:

```bash
npm run vapid
```

- The private key goes to `workers/ride-push/.dev.vars` (git-ignored). Keep it there and in the Worker's secrets, nowhere else.
- The public key replaces `VAPID_PUBLIC_KEY` in `shared/site.ts`, which the app and the Worker both read. Commit it.
- Changing the keys later invalidates every existing subscription, so the script refuses to run while `.dev.vars` already holds a key.

The Worker takes its other settings from `shared/site.ts` as well: it reads `/api` from `URL` and sends `CONTACT_EMAIL` as the push contact ([Production deployment, step 2](./deployment.md#2-fork-the-app-and-set-your-site)).

## 2. First deploy

Deploy the Worker with the private key from step 1:

```bash
npx wrangler deploy -c workers/ride-push/wrangler.toml --secrets-file workers/ride-push/.dev.vars
```

This creates the Worker and its `RideWatch` and `DisruptionWatch` Durable Object namespaces (migrations `v1` and `v2`), with SQLite storage, which the free plan includes.

**Check:** `npx wrangler secret list -c workers/ride-push/wrangler.toml` lists `VAPID_PRIVATE_KEY`.

## 3. Bind it to Pages

Pages > `<project>` > Settings > Bindings > Add > **Durable Object**:

| Field | Value |
| ----- | ----- |
| Variable name | `RIDE_WATCH` |
| Durable Object namespace | `departs-ride-push_RideWatch` |
| Environments | Production and Preview |

Add a second binding the same way for disruption notifications:

| Field | Value |
| ----- | ----- |
| Variable name | `DISRUPTION_WATCH` |
| Durable Object namespace | `departs-ride-push_DisruptionWatch` |
| Environments | Production and Preview |

The bindings apply from the next Pages deployment.

## 4. Deploy automatically

Workers & Pages > `departs-ride-push` > Settings > Build > **Connect** your fork:

| Setting | Value |
| ------- | ----- |
| Production branch | `master` |
| Build command | empty |
| Deploy command | `npx wrangler deploy -c workers/ride-push/wrangler.toml` |
| Preview builds | off |
| API token | *Create new token* |
| Build watch paths, include | `functions/_workers/**`, `functions/_core/push/**`, `functions/_domain/rides/**`, `functions/_domain/disruptions/**`, `functions/_core/config.ts`, `functions/_core/types.ts`, `shared/**`, `workers/**`, `package.json`, `package-lock.json` |

- `-c` points at this Worker's config; the root `wrangler.toml` belongs to the Pages project.
- The watch paths build the Worker only when its code or its dependencies change; `shared/` holds trip rules it compiles in.
- The secret from step 2 persists across builds.

## 5. Check it end to end

1. Open the app as an installed PWA on iOS, or in desktop Safari or Chrome.
2. Open a running vehicle, tap **I'm taking this trip**, pick an exit two or three stops ahead, save and allow notifications.
3. Run `npx wrangler tail departs-ride-push`.

The tail shows an alarm every 15–90 s, then a line like `{"push":"next","trip":"…","status":201}` one stop before the exit. `201` means the push service accepted the push. The notification arrives even with the screen locked.

For disruptions, pin a line in Prague or Brno and turn on **Disruptions on my lines** in Settings: `POST /api/<city>/disruptions` answers 200, and the next new incident on that line logs `{"push":"disruption","status":201}`.

## Operating it

- **Updates:** Workers Builds deploys the Worker from `master` when its watch paths change.
- **Previews:** a preview deployment talks to the production Worker, so a change to `RideWatch` reaches previews only after it is merged. To test one first, deploy it by hand with the command from step 4.
- **Compatibility:** the Pages endpoints and the Worker deploy separately. A change to the message between them (`RideWatchRequest`, `DisruptionWatchRequest`) must keep accepting the old shape until both are out.
- **Order of the first deploy:** deploy the Worker (migration `v2`) and add the `DISRUPTION_WATCH` binding before the Pages deployment that shows the switch; until then the endpoint answers 503 and the switch shows an error.
- **Disruptions:** `DisruptionWatch` (one per city with alerts) reads `/api/<city>/alerts` every 5 minutes (its cache lifetime) while anyone is subscribed and logs `{"push":"disruption","status":201}` for each push; the first read after it starts only marks what is running as seen.
- **Privacy:** the server keeps each rider's push address for at most the ride (4 h), and a disruption subscription until it is turned off or not renewed for 60 days. Update the privacy policy (`legal.privacy` in the locale files) if what it stores changes.
- **Logs:** `npx wrangler tail departs-ride-push` for the Worker, `npx wrangler pages deployment tail --project-name <project>` for the endpoint.
