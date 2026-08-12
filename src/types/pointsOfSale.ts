export type PointOfSaleType =
    | 'ticketMachine'
    | 'ticketOfficeMetro'
    | 'informationCenter'
    | 'trainStation'
    | 'carrierOffice'
    | 'chipCardDispense';

export type PointOfSaleService =
    | 'card_application'
    | 'card_issuance'
    | 'coupons'
    | 'paper_tickets'
    | 'penalties'
    | 'information'
    | 'tkt_prep';

export type PointOfSalePayMethod = 'cash' | 'card' | 'contactless';

export interface PointOfSaleOpeningHour {
    from: number; // 0 = Monday, 6 = Sunday
    to: number;
    hours: string; // e.g. "5:00-24:00"
}

export interface PointOfSale {
    id: string;
    type: PointOfSaleType;
    name: string;
    address: string;
    lat: number;
    lon: number;
    openingHours: PointOfSaleOpeningHour[];
    services: PointOfSaleService[];
    payMethods: PointOfSalePayMethod[];
}
