import type { DurableObjectNamespace, Fetcher, KVNamespace } from "@cloudflare/workers-types";

export interface Env {
    ASSETS: Fetcher;
    FEEDBACK_STORE: KVNamespace;
    // Secrets are typed as possibly-undefined: a missing binding is a runtime reality, not a type error.
    GOLEMIO_API_KEY: string | undefined;
    TURNSTILE_SECRET_KEY: string | undefined;
    /**
     * Local dev only, bound by `npm run dev`: the DPMP CSV via the Vite relay, since local workerd
     * rejects the upstream's legacy TLS. Not in `.dev.vars`: `[secrets] required` filters it out there.
     */
    DPMP_REALTIME_URL?: string;
    /** The ride-push Worker's `RideWatch` Durable Objects; unbound where that Worker isn't deployed. */
    RIDE_WATCH?: DurableObjectNamespace;
}

/**
 * What a city use-case actually reads off a request: the query, the bindings, and a way to run work
 * past the response. Callers with a real Cloudflare `EventContext` derive this from `request.url`;
 * MCP builds one directly, with no `Request` object to fake.
 */
export interface CityRequestContext {
    url: URL;
    env: Env;
    waitUntil: (promise: Promise<unknown>) => void;
}

export type {
    AppVehicleDescriptor,
    AppRouteType,
    AppVehicleState,
    AppStopTimeProperties,
    AppContinuation,
    AppStopConnection,
    AppDepartureFeeder,
    AppVehicleCollection,
    AppVehicleProperties,
    AppVehicleFeature,
    AppVehicleDetail,
    AppDeparture,
    AppDepartureResponse,
    AppAlert,
    AppInfotext,
    AppAlertsResponse,
    AppCitiesResponse,
} from '../../shared/api';
