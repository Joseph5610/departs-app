import type { AppInfotext } from "../../../_core/types";
import type { CityConfig } from '../../../_core/city-config';
import type { InfotextsUseCase } from '../../use-cases';

export class InfotextsService implements InfotextsUseCase {
    constructor(public readonly city: CityConfig) {}

    async getInfotexts(): Promise<AppInfotext[]> {
        return Promise.resolve([]);
    }
}
