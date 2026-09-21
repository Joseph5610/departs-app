import type { AppDeparture, AppDepartureResponse, AppVehicleProperties, CityRequestContext } from "../../../_core/types";
import type { CityConfig } from '../../../_core/city-config';
import { ApiError } from '../../../_core/errors';
import { ERROR_MESSAGES } from '../../../_core/config';
import { departuresQuerySchema, parseSearchParams } from '../../../_core/schemas';
import { normalizeRouteType } from '../../../_core/utils/routeTypes';
import { getStopIndex } from '../../gtfs/index/stop-index';
import { boardVehicles, collectDepartureTuples } from '../../gtfs/departures/DeparturesService';
import type { DeparturesUseCase } from '../../use-cases';
import { DeparturesMapper } from '../../gtfs/departures/DeparturesMapper';
import type { GtfsDepartureTuple } from '../../../_feeds/gtfs/types';
import type { VehiclesService } from '../../gtfs/vehicles/VehiclesService';
import { getGtfsRoutes, type GtfsRoute } from '../../../_feeds/gtfs/gtfs-data';
import { getDukStationBoard, getDukUnplacedLines, surveyDukUnplacedLines, type DukBoardDeparture } from '../../../_feeds/duk/duk-station-board';
import { DUK_CONFIG } from '../../../_feeds/duk/config';
import { getDukVehicleColor } from '../colors';

const minuteOf = (epochMs: number) => Math.round(epochMs / 60_000);
const linkKey = (node: string, line: string, epochMs: number) => `${node}|${line.toUpperCase()}|${minuteOf(epochMs)}`;

/** A requested stop id resolved to its Portabo node and, for a platform, its post. */
interface StopRequest {
    id: string;
    node: string;
    post: string | null;
}

interface TimetableLink {
    tripId: string;
    headsign: string;
    routeType: string | number;
    routeColor?: string;
    isWheelchairAccessible: boolean | null;
    isRequestStop: boolean;
}

/**
 * DÚK departures are Portabo's live boards, as tabule.portabo.cz shows them per platform. Each
 * departure is linked to the CIS JŘ timetable trip of the same line and minute, for the trip's
 * timeline, vehicle and accessibility; the timetable alone is served only when Portabo fails.
 *
 * Stop ids are `centroid-<node>` (station), `<node>-<post>` (platform) or a bare `<node>`.
 */
export class DukDeparturesService implements DeparturesUseCase {
    constructor(
        private readonly city: CityConfig,
        private readonly vehiclesService?: VehiclesService
    ) {}

    async getDepartures(ctx: CityRequestContext): Promise<AppDepartureResponse> {
        const { stopId: stopIds } = parseSearchParams(ctx.url.searchParams, departuresQuerySchema);
        if (!stopIds || stopIds.length === 0) {
            throw new ApiError(ERROR_MESSAGES.MISSING_PARAMS, 400);
        }
        const stopIndex = getStopIndex(this.city);

        const requests = stopIds.map(parseStopId);
        const nodes = [...new Set(requests.map(r => r.node))];

        const parentToChildMap = await stopIndex.parentToChildMap().catch(() => ({} as Record<string, string[]>));
        const platformsOf = (node: string) => parentToChildMap[`${DUK_CONFIG.STATION_PREFIX}${node}`] ?? [];
        const [boards, tuples, { routes }, vehiclesByTrip] = await Promise.all([
            Promise.all(requests.map(r => this.getBoard(r, platformsOf(r.node), ctx))),
            collectDepartureTuples(stopIndex, nodes, new Map(nodes.map(n => [n, n]))).catch((e) => {
                console.warn('[DUK] Timetable unavailable for board linking:', e);
                return [] as { stopId: string; tuple: GtfsDepartureTuple }[];
            }),
            getGtfsRoutes(this.city),
            this.getVehiclesByTrip(),
        ]);

        const boardOf = new Map(requests.map((r, i) => [r.id, boards[i]]));
        if (boards.some(board => board === null)) {
            return this.timetableOnly(requests, tuples, routes);
        }

        const links = new Map<string, TimetableLink[]>();
        for (const { stopId: node, tuple } of tuples) {
            const route = routes[tuple[1]];
            if (!route) continue;
            const key = linkKey(node, String(route.name), tuple[3]);
            const bucket = links.get(key);
            const link = toLink(tuple, route);
            if (bucket) bucket.push(link);
            else links.set(key, [link]);
        }

        const departures: AppDeparture[] = [];

        for (const request of requests) {
            const knownPlatforms = new Set(platformsOf(request.node));
            const board = boardOf.get(request.id) ?? [];
            const directionsAt = new Map<string, Set<string>>();
            for (const entry of board) {
                const key = linkKey(request.node, entry.line, entry.scheduledMs);
                const directions = directionsAt.get(key) ?? new Set<string>();
                directions.add(directionKey(entry.direction));
                directionsAt.set(key, directions);
            }
            const used = new Set<TimetableLink>();
            const seen = new Set<string>();
            for (const entry of board) {
                // Portabo repeats a trip it knows from two sources, not always with the platform; the live copy comes first.
                const identity = `${entry.line}|${directionKey(entry.direction)}|${entry.scheduledMs}`;
                if (seen.has(identity)) continue;
                seen.add(identity);

                const key = linkKey(request.node, entry.line, entry.scheduledMs);
                const isOneWay = (directionsAt.get(key)?.size ?? 0) <= 1;
                const link = pickLink(links.get(key), entry, used, isOneWay) ?? nearbyLink(links, entry, request.node, used);
                if (link) used.add(link);

                // Portabo's virtual post means it does not know the platform.
                const platform = entry.post !== String(DUK_CONFIG.VIRTUAL_POST) && knownPlatforms.has(`${request.node}-${entry.post}`) ? entry.post : null;

                // Boards label some through trips "konečná zastávka"; only a timetable link tells them from arrivals.
                const isTerminating = entry.direction === DUK_CONFIG.TERMINATING_DIRECTION;
                if (isTerminating && !link) continue;

                departures.push(this.mapEntry(entry, request.id, platform, isTerminating ? link?.headsign : undefined, link, link ? vehiclesByTrip.get(link.tripId) : undefined));
            }
        }

        departures.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
        return { departures };
    }

    /**
     * A platform's board is Portabo's board for its post. Departures of lines Portabo never places
     * on any platform of the station (Most's trams) are added from its virtual post; which lines
     * those are is surveyed in the background, since reading it costs a board per platform.
     */
    private async getBoard(request: StopRequest, platforms: string[], ctx: CityRequestContext): Promise<DukBoardDeparture[] | null> {
        const virtualPost = String(DUK_CONFIG.VIRTUAL_POST);
        const schedule = (task: Promise<unknown>) => ctx.waitUntil(task);
        if (!request.post || request.post === virtualPost) {
            return getDukStationBoard(this.city, request.node, request.post ?? DUK_CONFIG.WHOLE_STATION_POST, schedule);
        }

        const posts = [...new Set([request.post, ...platforms.map(id => id.split('-')[1])])].filter(post => post !== virtualPost);
        const unplaced = getDukUnplacedLines(this.city, request.node);
        if (!unplaced) ctx.waitUntil(surveyDukUnplacedLines(this.city, request.node, posts));

        const [own, virtual] = await Promise.all([
            getDukStationBoard(this.city, request.node, request.post, schedule),
            // Until the survey answers, the virtual post is read too, so nothing is missing meanwhile.
            unplaced?.size === 0 ? null : getDukStationBoard(this.city, request.node, virtualPost, schedule),
        ]);
        if (!own) return null;
        const elsewhere = (virtual ?? []).filter(entry => !unplaced || unplaced.has(entry.line));
        return [...own, ...elsewhere].sort((a, b) => a.scheduledMs - b.scheduledMs);
    }

    /** The timetable's departures for the requested stops, for when Portabo has no board. */
    private async timetableOnly(
        requests: StopRequest[],
        tuples: { stopId: string; tuple: GtfsDepartureTuple }[],
        routes: Record<string, GtfsRoute>
    ): Promise<AppDepartureResponse> {
        const deps: { stopId: string; tuple: GtfsDepartureTuple }[] = [];
        for (const request of requests) {
            for (const { stopId: node, tuple } of tuples) {
                if (node === request.node) deps.push({ stopId: request.id, tuple });
            }
        }
        return { departures: DeparturesMapper.mapDepartures(deps, routes, await boardVehicles(this.vehiclesService)) };
    }

    private async getVehiclesByTrip(): Promise<Map<string, AppVehicleProperties>> {
        const collection = await boardVehicles(this.vehiclesService);
        const byTrip = new Map<string, AppVehicleProperties>();
        for (const f of collection?.features ?? []) {
            if (f.properties.gtfs_trip_id && f.properties.vehicle_id) byTrip.set(f.properties.gtfs_trip_id, f.properties);
        }
        return byTrip;
    }

    private mapEntry(
        entry: DukBoardDeparture,
        stopId: string,
        platform: string | null,
        headsignOverride: string | undefined,
        link: TimetableLink | undefined,
        vehicle: AppVehicleProperties | undefined
    ): AppDeparture {
        const type = normalizeRouteType(
            (entry.traction !== null ? DUK_CONFIG.TRACTION_ROUTE_TYPES[entry.traction] : undefined)
            ?? link?.routeType
            ?? 'bus'
        );
        const isStepFree = entry.notes.some(note => note.includes(DUK_CONFIG.STEP_FREE_NOTE));
        // Portabo carries a vehicle's current delay onto all its later trips; only the trip it is on is live.
        const isLive = !link || Boolean(vehicle);
        // Boards carry only timetable times for some operators (DPmÚL); the vehicle on the trip still knows its delay.
        const delay = isLive ? entry.delay ?? vehicle?.delay ?? null : null;
        const expectedMs = entry.delay === null && delay !== null ? entry.scheduledMs + delay * 1000 : entry.expectedMs;

        return {
            tripId: link?.tripId,
            vehicleId: vehicle?.vehicle_id ?? undefined,
            line: entry.line,
            type,
            directionId: '0',
            headsign: headsignOverride ?? entry.direction,
            scheduled: new Date(entry.scheduledMs).toISOString(),
            timestamp: new Date(isLive ? expectedMs : entry.scheduledMs).toISOString(),
            delay,
            isCanceled: false,
            platform: platform && Number(platform) < DUK_CONFIG.FIRST_UNNUMBERED_POST ? platform : undefined,
            route_color: link?.routeColor ?? getDukVehicleColor(type, entry.line),
            stopId,
            is_air_conditioned: vehicle?.vehicle_descriptor?.is_air_conditioned ?? null,
            is_wheelchair_accessible: isStepFree || vehicle?.vehicle_descriptor?.is_wheelchair_accessible === true ? true : link?.isWheelchairAccessible ?? null,
            is_request_stop: link?.isRequestStop,
        };
    }
}

/** A stop name reduced to its last part for comparison: "Ústí n.L.,Dobětice točna" -> "dobeticetocna". */
function directionKey(name: string): string {
    const last = name.split(',').pop() ?? name;
    return last.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * The timetable departure a board entry is: the same line and minute can leave in both directions,
 * so the one heading where the board says wins. A trip heading elsewhere is still the entry's when
 * the board shows that minute going one way only (through-running beyond the timetable's end).
 */
function pickLink(
    candidates: TimetableLink[] | undefined,
    entry: DukBoardDeparture,
    used: Set<TimetableLink>,
    isOneWay: boolean
): TimetableLink | undefined {
    const direction = directionKey(entry.direction);
    let fallback: TimetableLink | undefined;
    for (const link of candidates ?? []) {
        if (used.has(link)) continue;
        const headsign = directionKey(link.headsign);
        if (direction && headsign && (direction.includes(headsign) || headsign.includes(direction))) return link;
        if (isOneWay) fallback ??= link;
    }
    return fallback;
}

/** A timetable departure heading the same way within a couple of minutes, where JDF and Portabo times differ. */
function nearbyLink(
    links: Map<string, TimetableLink[]>,
    entry: DukBoardDeparture,
    node: string,
    used: Set<TimetableLink>
): TimetableLink | undefined {
    for (let offset = 1; offset <= DUK_CONFIG.LINK_TOLERANCE_MINS; offset++) {
        for (const sign of [-1, 1]) {
            const candidates = links.get(linkKey(node, entry.line, entry.scheduledMs + sign * offset * 60_000));
            const link = pickLink(candidates, entry, used, false);
            if (link) return link;
        }
    }
    return undefined;
}

function parseStopId(id: string): StopRequest {
    if (id.startsWith(DUK_CONFIG.STATION_PREFIX)) return { id, node: id.slice(DUK_CONFIG.STATION_PREFIX.length), post: null };
    const [node, post] = id.split('-');
    return { id, node, post: post ?? null };
}

function toLink(tuple: GtfsDepartureTuple, route: GtfsRoute): TimetableLink {
    const wheelchair = tuple[4];
    return {
        tripId: tuple[0],
        headsign: tuple[2],
        routeType: route.type,
        routeColor: route.route_color,
        isWheelchairAccessible: wheelchair === 1 ? true : wheelchair === 2 ? false : null,
        isRequestStop: tuple[5] === 1,
    };
}
