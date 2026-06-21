export interface GtfsAlertEntity {
    id: string;
    alert?: {
        effect?: string;
        cause?: string | number;
        causeDetail?: { translation?: Array<{ text: string, language?: string }> };
        activePeriod?: Array<{ start?: number | string; end?: number | string }>;
        informedEntity?: Array<{ routeId?: string }>;
        headerText?: { translation?: Array<{ text: string }> };
        descriptionText?: { translation?: Array<{ text: string }> };
        url?: { translation?: Array<{ text: string }> };
    };
}
