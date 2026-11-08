import { DurableObject } from 'cloudflare:workers';
import { DISRUPTION_PUSH, RIDE_PUSH } from '../_core/config';
import { sendPush, vapidAuthorizer } from '../_core/push/webPush';
import type { AppAlert, AppAlertsResponse } from '../_core/types';
import { handleRequest, runAlarm, type DisruptionWatchRequest } from '../_domain/disruptions/watchRun';
import type { RidePushEnv } from './RideWatch';

const DELIVERY = { ttlS: DISRUPTION_PUSH.TTL_S, urgency: 'normal' } as const;

/** One city's subscriptions to disruptions on pinned lines; the watch itself is `disruptions/watchRun.ts`, this wires it to storage, our `/api` and Web Push. */
export class DisruptionWatch extends DurableObject<RidePushEnv> {
    async fetch(request: Request): Promise<Response> {
        const status = await handleRequest(this.ctx.storage, await request.json<DisruptionWatchRequest>(), Date.now());
        return new Response(null, { status });
    }

    async alarm(): Promise<void> {
        const { VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey } = this.env;
        const now = Date.now();
        const authorize = publicKey && privateKey ? vapidAuthorizer({ publicKey, privateKey, subject: RIDE_PUSH.VAPID_SUBJECT }, Math.floor(now / 1000)) : null;
        // Without keys the watch keeps running, sending nothing: subscribers survive a bad deploy and lapsed ones are still swept.
        if (!authorize) console.error('VAPID keys are not configured; disruption pushes are off.');
        await runAlarm(this.ctx.storage, {
            readAlerts: city => this.readAlerts(city),
            push: async (subscription, payload) => (authorize ? sendPush(subscription, payload, authorize, DELIVERY).catch((error: unknown) => {
                console.error('Push failed', error);
                return 0;
            }) : 0),
        }, now);
    }

    private async readAlerts(city: string): Promise<AppAlert[] | null> {
        try {
            const response = await fetch(new URL(`/api/${city}/alerts`, this.env.API_ORIGIN));
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return (await response.json<AppAlertsResponse>()).alerts ?? null;
        } catch (error) {
            console.error('Alerts read failed', city, error);
            return null;
        }
    }
}
