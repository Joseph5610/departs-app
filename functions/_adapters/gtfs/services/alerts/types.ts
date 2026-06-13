export interface GtfsAlertEntity {
    id: string;
    alert?: {
        effect?: string;
        informedEntity?: Array<{ routeId?: string }>;
        headerText?: { translation?: Array<{ text: string }> };
        descriptionText?: { translation?: Array<{ text: string }> };
        url?: { translation?: Array<{ text: string }> };
    };
}
