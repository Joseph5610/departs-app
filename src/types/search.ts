export type SearchHistoryBase =
    | { type: 'stop'; stop_id: string; stop_name: string; platform_code?: string; coordinates: [number, number]; is_train?: boolean }
    | { type: 'line'; lines: string[] };

export type SearchHistoryItem = SearchHistoryBase & { timestamp: number };
