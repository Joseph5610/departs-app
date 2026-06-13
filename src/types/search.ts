export type SearchHistoryBase =
    | { type: 'stop'; city_slug?: string; stop_id: string; stop_name: string; platform_code?: string; coordinates: [number, number]; is_train?: number; metro_lines?: Array<{ name: string, route_color: string }>; lines?: Array<{ name: string, type: string, route_color: string }> }
    | { type: 'line'; city_slug?: string; lines: string[] }
    | { type: 'place'; city_slug?: string; place_id: string; name: string; subtitle?: string; coordinates: [number, number] };


export type SearchHistoryItem = SearchHistoryBase & { timestamp: number };
