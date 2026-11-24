/**
 * `npm run vapid`: creates the ride-push VAPID key pair once. The private key goes to `workers/ride-push/.dev.vars`
 * (local dev, and `--secrets-file` on the first deploy); the public key replaces `VAPID_PUBLIC_KEY` in `shared/site.ts`.
 * New keys invalidate every existing push subscription, so it refuses to run while `.dev.vars` already holds a key.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const devVars = path.join(root, 'workers/ride-push/.dev.vars');
const siteFile = path.join(root, 'shared/site.ts');

if (fs.existsSync(devVars) && fs.readFileSync(devVars, 'utf8').includes('VAPID_PRIVATE_KEY=')) {
    console.error(`${path.relative(root, devVars)} already holds a VAPID key; new keys would cut off every subscriber. Delete it first to really start over.`);
    process.exit(1);
}

const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
const publicKey = Buffer.from(await crypto.subtle.exportKey('raw', keys.publicKey)).toString('base64url');
const { d: privateKey } = await crypto.subtle.exportKey('jwk', keys.privateKey);

fs.writeFileSync(devVars, `VAPID_PRIVATE_KEY=${privateKey}\n`);
const site = fs.readFileSync(siteFile, 'utf8');
const updated = site.replace(/(VAPID_PUBLIC_KEY: ')[^']*(')/, `$1${publicKey}$2`);
if (updated === site) throw new Error('VAPID_PUBLIC_KEY not found in shared/site.ts');
fs.writeFileSync(siteFile, updated);

console.log(`Private key written to ${path.relative(root, devVars)}; public key written to shared/site.ts. Commit shared/site.ts.`);
