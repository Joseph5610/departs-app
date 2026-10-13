# Ride push deployment

Ride mode's alerts reach a locked phone only through Web Push, sent by the `departs-ride-push` Worker. This guide adds it to a deployment that already runs the app ([Production deployment](./deployment.md), steps 1–4). [Ride notifications](./ride-notifications.md) explains how it works.

The Worker is optional; without it, ride mode alerts only while the app is open.

## Why a separate Worker

Each trip is watched by a Durable Object, which only a Worker can define. Pages reaches it through a binding, so the Worker's public `workers.dev` address is turned off (`workers_dev = false` and `preview_urls = false` in `workers/ride-push/wrangler.toml`).

| Part | Lives in | Deployed by |
| ---- | -------- | ----------- |
| `/api/<city>/ride` endpoint, app, service worker | Pages project | Pages Git integration |
| `RideWatch` Durable Object | `departs-ride-push` Worker | Workers Builds (step 5) |

## 1. VAPID keys

VAPID keys sign every push, so push services know it comes from you. Generate a pair once:

```bash
node -e "crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign']).then(async k=>{console.log('VAPID_PUBLIC_KEY='+Buffer.from(await crypto.subtle.exportKey('raw',k.publicKey)).toString('base64url'));console.log('VAPID_PRIVATE_KEY='+(await crypto.subtle.exportKey('jwk',k.privateKey)).d)})" > workers/ride-push/.dev.vars
```

- `workers/ride-push/.dev.vars` is git-ignored. Keep the private key there and in the Worker's secrets, nowhere else.
- Copy the **public** key into `RIDE_PUSH_CONFIG.VAPID_PUBLIC_KEY` in `src/config/constants.ts`. The browser needs it to subscribe.
- Changing the keys later invalidates every existing subscription.

## 2. Hostnames and contact

| File | Setting | Value |
| ---- | ------- | ----- |
| `workers/ride-push/wrangler.toml` | `API_ORIGIN` under `[vars]` | Your production URL; the Worker reads vehicle details from its `/api` |
| `functions/_core/config.ts` | `RIDE_PUSH.VAPID_SUBJECT` | `mailto:` your contact address; Apple rejects pushes without one |

## 3. First deploy

Deploy the Worker with the secrets from step 1:

```bash
npx wrangler deploy -c workers/ride-push/wrangler.toml --secrets-file workers/ride-push/.dev.vars
```

This creates the Worker and its `RideWatch` Durable Object namespace, with SQLite storage, which the free plan includes.

**Check:** `npx wrangler secret list -c workers/ride-push/wrangler.toml` lists `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`.

## 4. Bind it to Pages

Pages > `<project>` > Settings > Bindings > Add > **Durable Object**:

| Field | Value |
| ----- | ----- |
| Variable name | `RIDE_WATCH` |
| Durable Object namespace | `departs-ride-push_RideWatch` |
| Environments | Production and Preview |

The binding applies from the next Pages deployment.

## 5. Deploy automatically

Workers & Pages > `departs-ride-push` > Settings > Build > **Connect** your fork:

| Setting | Value |
| ------- | ----- |
| Production branch | `master` |
| Build command | empty |
| Deploy command | `npx wrangler deploy -c workers/ride-push/wrangler.toml` |
| Preview builds | off |
| API token | *Create new token* |
| Build watch paths, include | `functions/_workers/**`, `functions/_core/push/**`, `functions/_domain/rides/**`, `functions/_core/config.ts`, `functions/_core/types.ts`, `workers/**` |

- `-c` points at this Worker's config; the root `wrangler.toml` belongs to the Pages project.
- The watch paths build the Worker only when its code changes.
- The secrets from step 3 persist across builds.

## 6. Check it end to end

1. Open the app as an installed PWA on iOS, or in desktop Safari or Chrome.
2. Open a running vehicle, tap **Alert me before my stop**, pick a stop two or three ahead and allow notifications.
3. Run `npx wrangler tail departs-ride-push`.

The tail shows an alarm every 15–90 s, then a line like `{"push":"next","trip":"…","status":201}` one stop before the exit. `201` means the push service accepted the push. The notification arrives even with the screen locked.

## Operating it

- **Updates:** Workers Builds deploys the Worker from `master` when its watch paths change.
- **Previews:** a preview deployment talks to the production Worker, so a change to `RideWatch` reaches previews only after it is merged. To test one first, deploy it by hand with the command from step 5.
- **Compatibility:** the Pages endpoint and the Worker deploy separately. A change to the message between them (`RideWatchRequest`) must keep accepting the old shape until both are out.
- **Privacy:** the server keeps each rider's push address for at most the ride (4 h). Update the privacy policy (`legal.privacy` in the locale files) if what it stores changes.
- **Logs:** `npx wrangler tail departs-ride-push` for the Worker, `npx wrangler pages deployment tail --project-name <project>` for the endpoint.
