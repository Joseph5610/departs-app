/**
 * Configuration for the Ústecký kraj (DÚK) adapter: static data built from the national JDF
 * export (departs-data `build-duk.mjs`) plus the Portabo realtime traffic feed.
 */
export const DUK_CONFIG = {
    /** Width of a CIS JŘ line number; the feed reports it as an unpadded integer. */
    LINE_NUMBER_LENGTH: 6,

    /** How far ahead of its planned start a vehicle may already report on a trip. */
    MAX_EARLY_START_MINS: 90,
    /** How long after its planned end a delayed trip may still be running. */
    MAX_LATE_END_MINS: 240,
    /** A vehicle this close to where its reported trip should be now is on that trip. */
    TRIP_FIT_M: 1_500,
    /** Otherwise it is on the line's trip running now towards its final stop that is at most this far off. */
    RUNNING_TRIP_FIT_M: 1_000,
    /** How long before its first or after its last stop a trip still counts as running. */
    SCHEDULE_FIT_MARGIN_S: 600,

    /** DÚK's prefix for regional train lines (U1, U4, …). */
    TRAIN_LINE_PREFIX: 'U',
    /** Feed `LineID` range of the U lines, numbered `OFFSET + n` (901 = U1). */
    TRAIN_LINE_IDS: { MIN: 901, MAX: 999, OFFSET: 900 },

    /** A feed time further ahead of now than this is a broken clock, not a newer position. */
    MAX_CLOCK_SKEW_MS: 120_000,

    /** Minimum distance before a heading is derived towards a stop or from movement. */
    BEARING_MIN_MOVE_M: 15,
    BEARING_CACHE_MAX_ENTRIES: 1024,
    /** Beyond this from a leg of its trip a vehicle is off it, so the leg says nothing about heading or progress. */
    MAX_ROUTE_DISTANCE_M: 300,
    /** Within this of a stop a vehicle is at it, whatever the legs around it say. */
    AT_STOP_RADIUS_M: 40,
    /** How much closer to another leg than to the one out of its reported stop a vehicle must be to be placed there. */
    APPROACH_LEG_MARGIN_M: 50,
    /** Stops ahead of the reported one the feed may have missed. */
    MAX_SKIPPED_STOPS: 2,

    /** How long the Portabo station names used for headsigns are kept. */
    STATION_NAMES_TTL_MS: 3_600_000,

    /** Station ids; platforms are `<node>-<post>` (departs-data `build-duk.mjs`). */
    STATION_PREFIX: 'centroid-',
    /** Departures requested per station board. */
    BOARD_DEPARTURE_COUNT: 20,
    BOARD_CACHE_MAX_ENTRIES: 256,
    /** A board older than this is refreshed; a busy station costs Portabo seconds, so the refresh runs behind the answer. */
    BOARD_FRESH_MS: 10_000,
    /** Past this the board is dropped and the next reader waits for a fresh one. */
    BOARD_MAX_STALE_MS: 120_000,
    /** Portabo answers a busy station in about 3s; beyond this it is stuck, not slow. */
    BOARD_TIMEOUT_MS: 6_000,
    /** Lines Portabo never places on a platform change with the timetable, not during the day. */
    UNPLACED_LINES_TTL_MS: 6 * 3_600_000,
    /** Portabo degrades when a station's platforms are asked for at once, so the survey walks them. */
    UNPLACED_SURVEY_CONCURRENCY: 2,
    /** Portabo's catch-all platform, which carries no platform of its own. */
    VIRTUAL_POST: 999,
    /** Board post that asks Portabo for every platform of a station. */
    WHOLE_STATION_POST: '0',
    /** Posts from here on are Portabo's rail and ferry stops, not numbered bus platforms. */
    FIRST_UNNUMBERED_POST: 90,
    /** Attempts per board fetch; Portabo occasionally fails a single request. */
    BOARD_FETCH_ATTEMPTS: 2,
    /** How far apart, in minutes, a board departure and its timetable trip may be when heading the same way. */
    LINK_TOLERANCE_MINS: 2,
    /** Board direction of trips ending at the stop; these arrive rather than depart. */
    TERMINATING_DIRECTION: 'konečná zastávka',
    /** Board note marking a trip run with a step-free vehicle. */
    STEP_FREE_NOTE: 'bezbariérově přístupným vozidlem',
    /** Portabo `Traction` codes; 0 means unknown and defers to the timetable. */
    TRACTION_ROUTE_TYPES: { 1: 'tram', 2: 'trolleybus', 3: 'bus', 5: 'train', 6: 'ferry' } as Record<number, string>,
} as const;
