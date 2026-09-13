import '../lib/zod-config';
import { z } from 'zod/mini';

const POINT_OF_SALE_TYPES = ['ticketMachine', 'ticketOfficeMetro', 'informationCenter', 'trainStation', 'carrierOffice', 'chipCardDispense'] as const;
const POINT_OF_SALE_SERVICES = ['card_application', 'card_issuance', 'coupons', 'paper_tickets', 'penalties', 'information', 'tkt_prep'] as const;
const POINT_OF_SALE_PAY_METHODS = ['cash', 'card', 'contactless'] as const;

/** Keeps the known values of a string list, so a value added upstream doesn't reject the whole point of sale. */
const knownValues = <T extends string>(allowed: readonly T[]) => {
    const allowedSet = new Set<string>(allowed);
    return z.pipe(z.array(z.string()), z.transform(values => values.filter((v): v is T => allowedSet.has(v))));
};

/** One entry of the static `points-of-sale.json` published per city. */
export const pointOfSaleSchema = z.object({
    id: z.string(),
    type: z.enum(POINT_OF_SALE_TYPES),
    name: z.string(),
    address: z.string(),
    lat: z.number(),
    lon: z.number(),
    openingHours: z.array(z.object({
        /** 0 = Monday, 6 = Sunday */
        from: z.number(),
        to: z.number(),
        /** e.g. "5:00-24:00" */
        hours: z.string(),
    })),
    services: knownValues(POINT_OF_SALE_SERVICES),
    payMethods: knownValues(POINT_OF_SALE_PAY_METHODS),
});

export type PointOfSale = z.infer<typeof pointOfSaleSchema>;
export type PointOfSaleType = PointOfSale['type'];
