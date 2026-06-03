export interface GolemioInfotext {
    id: string;
    priority: 'low' | 'normal' | 'high';
    display_type: 'inline' | 'general';
    text: string;
    text_en: string | null;
    related_stops: Array<{
        id: string;
        name: string;
        platform_code: string | null;
    }>;
    valid_from: string;
    valid_to: string | null;
}
