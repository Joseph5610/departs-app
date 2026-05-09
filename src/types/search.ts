export type SearchHistoryBase =
    | { type: 'stop'; stop_id: string; stop_name: string; platform_code?: string; coordinates: [number, number]; is_train?: number; metro_lines?: Array<{ name: string, route_color: string }>; lines?: Array<{ name: string, type: string, route_color: string }> }
    | { type: 'line'; lines: string[] }
    | { type: 'place'; place_id: string; name: string; subtitle?: string; coordinates: [number, number] };


export type SearchHistoryItem = SearchHistoryBase & { timestamp: number };
