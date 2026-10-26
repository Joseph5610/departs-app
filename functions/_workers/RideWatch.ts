import { DurableObject } from 'cloudflare:workers';
import { RIDE_PUSH } from '../_core/config';
import { sendPush } from '../_core/push/webPush';
import type { AppVehicleDetail } from '../_core/types';
import { handleRequest, runAlarm, type RideTrip, type RideWatchRequest } from '../_domain/rides/watchRun';

export interface RidePushEnv {
    /** The departs.app origin whose `/api` answers vehicle details (a `[vars]` entry, overridden for local dev). */
    API_ORIGIN: string;
    VAPID_PUBLIC_KEY: string | undefined;
    VAPID_PRIVATE_KEY: string | undefined;
}

/** One trip's riders, every device on it; the watch itself is `watchRun.ts`, this wires it to storage, our `/api` and Web Push. */
export class RideWatch extends DurableObject<RidePushEnv> {
    async fetch(request: Request): Promise<Response> {
        const status = await handleRequest(this.ctx.storage, await request.json<RideWatchRequest>(), Date.now());
        return new Response(null, { status });
    }

    async alarm(): Promise<void> {
        const { VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey } = this.env;
        if (!publicKey || !privateKey) {
            console.error('VAPID keys are not configured; ride pushes are off.');
            return this.ctx.storage.deleteAll();
        }
        const vapid = { publicKey, privateKey, subject: RIDE_PUSH.VAPID_SUBJECT };
        const now = Date.now();
        await runAlarm(this.ctx.storage, {
            readDetail: trip => this.readDetail(trip),
            // One broken subscription must not stop the trip's other riders.
            push: (subscription, payload) => sendPush(subscription, payload, vapid, Math.floor(now / 1000)).catch((error: unknown) => {
                console.error('Push failed', error);
                return 0;
            }),
        }, now);
    }

    /** The trip's detail; `missing` when the API knows no such trip, null when the read failed. */
    private async readDetail(trip: RideTrip): Promise<AppVehicleDetail | null | 'missing'> {
        const url = new URL(`/api/${trip.city}/vehicle-detail`, this.env.API_ORIGIN);
        url.searchParams.set('tripId', trip.tripId);
        try {
            const response = await fetch(url);
            if (response.status === 404) return 'missing';
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json<AppVehicleDetail>();
        } catch (error) {
            console.error('Ride detail failed', trip.city, trip.tripId, error);
            return null;
        }
    }
}
