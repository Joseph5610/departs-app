export interface BrnoVehicleMetadata {
    vehicle_type: string;
    is_air_conditioned?: boolean;
}

/**
 * Resolves static model types and air-conditioning status based on Brno (DPMB) registration numbers.
 */
export function getDpmbVehicleMetadata(registrationNumber: string | number): BrnoVehicleMetadata | null {
    const num = typeof registrationNumber === 'number' ? registrationNumber : parseInt(registrationNumber, 10);
    if (isNaN(num)) return null;

    // Trams (1000 - 1999)
    if (num >= 1000 && num <= 1999) {
        if (num >= 1018 && num <= 1132) {
            return { vehicle_type: 'ČKD Tatra K2 / Pragoimex VarioLF2R.E' };
        }
        if (num >= 1201 && num <= 1246) {
            return { vehicle_type: 'ČKD Tatra T6A5' };
        }
        if (num >= 1497 && num <= 1666) {
            return { vehicle_type: 'ČKD Tatra T3 / Pragoimex T3' };
        }
        if (num >= 1701 && num <= 1738) {
            return { vehicle_type: 'ČKD Tatra KT8D5' };
        }
        if (num >= 1751 && num <= 1754) {
            return { vehicle_type: 'Pars Nova K3R-N' };
        }
        if (num >= 1760 && num <= 1799) {
            return { vehicle_type: 'Škoda 45T', is_air_conditioned: true };
        }
        if (num >= 1807 && num <= 1817) {
            return { vehicle_type: 'Škoda 03T Anitra' };
        }
        if (num >= 1822 && num <= 1862) {
            return { vehicle_type: 'Pragoimex EVO2', is_air_conditioned: true };
        }
        if (num >= 1900 && num <= 1949) {
            const hasAc = num >= 1930;
            return { vehicle_type: 'Škoda 13T', is_air_conditioned: hasAc };
        }
        return { vehicle_type: 'Tramvaj' };
    }

    // Buses (2000 - 2999 and 7000 - 7999)
    if ((num >= 2000 && num <= 2999) || (num >= 7000 && num <= 7999)) {
        if (num >= 2001 && num <= 2044) {
            return { vehicle_type: 'Iveco Urbanway 18M CNG', is_air_conditioned: true };
        }
        if (num >= 2623 && num <= 2691) {
            const hasAc = num >= 2647;
            return { vehicle_type: 'Solaris Urbino 18', is_air_conditioned: hasAc };
        }
        if (num >= 2911 && num <= 2914) {
            return { vehicle_type: 'Iveco Crossway LE 12M', is_air_conditioned: true };
        }
        if (num >= 7001 && num <= 7044) {
            return { vehicle_type: 'SOR NBG 12 / Irisbus Citelis 12M' };
        }
        if (num >= 7045 && num <= 7100) {
            return { vehicle_type: 'Iveco Urbanway 12M CNG', is_air_conditioned: true };
        }
        if (num >= 7101 && num <= 7116) {
            return { vehicle_type: 'SOR NBG 12' };
        }
        if (num === 7526) {
            return { vehicle_type: 'Isuzu Novo Citi Life', is_air_conditioned: true };
        }
        if (num >= 7672 && num <= 7686) {
            return { vehicle_type: 'Iveco Urbanway 12M', is_air_conditioned: true };
        }
        if (num >= 7687 && num <= 7737) {
            return { vehicle_type: 'SOR NS 12', is_air_conditioned: true };
        }
        if (num >= 7826 && num <= 7830) {
            return { vehicle_type: 'Iveco Crossway LE City', is_air_conditioned: true };
        }
        return { vehicle_type: 'Autobus' };
    }

    // Trolleybuses (3000 - 3999)
    if (num >= 3000 && num <= 3999) {
        if (num >= 3065 && num <= 3076) {
            return { vehicle_type: 'SOR TNS 12', is_air_conditioned: true };
        }
        if (num >= 3301 && num <= 3310) {
            return { vehicle_type: 'Škoda 26Tr' };
        }
        if (num >= 3311 && num <= 3350) {
            return { vehicle_type: 'Škoda 32Tr', is_air_conditioned: true };
        }
        if (num >= 3618 && num <= 3647) {
            return { vehicle_type: 'Škoda 31Tr' };
        }
        if (num >= 3648 && num <= 3687) {
            return { vehicle_type: 'Škoda 27Tr', is_air_conditioned: true };
        }
        return { vehicle_type: 'Trolejbus' };
    }

    // Boats/Ferries (4800 - 4899)
    if (num >= 4800 && num <= 4899) {
        if (num === 4801) return { vehicle_type: 'Loď - Brno' };
        if (num === 4805) return { vehicle_type: 'Loď - Morava' };
        if (num >= 4823 && num <= 4827) {
            const names = ['Lipsko', 'Utrecht', 'Vídeň', 'Stuttgart', 'Dallas'];
            const name = names[num - 4823] || 'Loď';
            return { vehicle_type: `Loď - ${name}` };
        }
        return { vehicle_type: 'Loď' };
    }

    return null;
}
