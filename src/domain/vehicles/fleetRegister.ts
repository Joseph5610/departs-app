import { FLEET_REGISTER } from '@/config/fleetRegister';

const CZ_PLATE = /^([0-9][A-Z][0-9A-Z]) ?([0-9]{4})$/;
const CZ_ELECTRIC_PLATE = /^EL ?([0-9]{3}[A-Z]{2})$/;
const FLEET_NUMBER = /^[0-9]+$/;

/** A Czech licence plate in the register's spelling (`1BX 5363`, `EL 123AB`); null when it is not one. */
export const czechPlateOf = (raw: string): string | null => {
    const s = raw.trim().toUpperCase();
    const plate = CZ_PLATE.exec(s);
    if (plate) return `${plate[1]} ${plate[2]}`;
    const electric = CZ_ELECTRIC_PLATE.exec(s);
    return electric ? `EL ${electric[1]}` : null;
};

/**
 * The vehicle on seznam-autobusu.cz: by licence plate, else by fleet number within a carrier the city
 * config names, else within the city's carrier country; null when none of them narrows the search.
 */
export const fleetRegisterUrl = (
    citySlug: string,
    operator: string | undefined,
    registration: string | number | undefined,
): string | null => {
    if (registration === undefined) return null;
    const number = String(registration).trim();
    const plate = czechPlateOf(number);
    if (plate) return `${FLEET_REGISTER.SEARCH_URL}?${new URLSearchParams({ spz: plate })}`;
    if (!FLEET_NUMBER.test(number)) return null;
    const carrier = operator ? FLEET_REGISTER.CARRIERS[citySlug]?.[operator] : undefined;
    if (carrier) return `${FLEET_REGISTER.SEARCH_URL}?${new URLSearchParams({ prov: '1', dopravce: carrier, evc: number, zapujcka: '2' })}`;
    const countryId = FLEET_REGISTER.COUNTRY_IDS[citySlug];
    if (countryId === undefined) return null;
    return `${FLEET_REGISTER.SEARCH_URL}?${new URLSearchParams({ prov: '1', operatorCountryId: String(countryId), evc: number, zapujcka: '2' })}`;
};

export interface VehicleIdentifiers {
    /** The operator's fleet number. */
    fleetNumber?: string;
    /** A Czech licence plate in the register's spelling. */
    plate?: string;
    run?: string;
}

const present = (value: string | number | null | undefined): string | undefined => {
    const s = value == null ? '' : String(value).trim();
    return s && s !== '0' ? s : undefined;
};

/**
 * A vehicle's identifiers, each named once: a registration that is a licence plate is the plate and the
 * vehicle id the fleet number; any other registration is itself the fleet number.
 */
export const vehicleIdentifiers = (
    vehicleId: string | null | undefined,
    registration: string | number | undefined,
    runNumber: string | number | null | undefined,
): VehicleIdentifiers => {
    const reg = present(registration);
    const id = present(vehicleId);
    const plate = reg ? czechPlateOf(reg) ?? undefined : undefined;
    const fleetNumber = plate ? (id && czechPlateOf(id) === null ? id : undefined) : reg ?? id;
    return { fleetNumber, plate, run: present(runNumber) };
};
