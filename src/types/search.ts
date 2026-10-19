import type { BoardStop } from './stops';

/** A recent search. A stop keeps only its id and its name, the label shown while its city's stop list is not loaded. */
export type SearchHistoryBase =
    | { type: 'stop'; city_slug?: string; stop_id: string; stop_name: string }
    | { type: 'line'; city_slug?: string; lines: string[] }
    | { type: 'place'; city_slug?: string; place_id: string; name: string; subtitle?: string; coordinates: [number, number] }
    | { type: 'pos'; city_slug?: string; pos_id: string; name: string; subtitle?: string; coordinates: [number, number] };


export type SearchHistoryItem = SearchHistoryBase & { timestamp: number };

/** A recent search as listed: a stop of the selected city carries what today's stop list says of it. */
export type ShownHistoryItem = SearchHistoryItem & { stop?: BoardStop };
