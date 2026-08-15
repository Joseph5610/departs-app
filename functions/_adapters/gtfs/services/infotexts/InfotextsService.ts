import type { AppInfotext } from "../../../../_core/types";
import type { CityConfig } from '../../../../_core/city-config';

export class InfotextsService {
    constructor(public readonly city: CityConfig) {}

    async getInfotexts(): Promise<AppInfotext[]> {
        return Promise.resolve([]);
    }
}
