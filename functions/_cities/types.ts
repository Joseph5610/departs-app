import type { Env } from '../_core/types';
import type { CityConfig } from '../_core/city-config';
import type { CityUseCases } from '../_domain/use-cases';

/** A city is a declaration: its config, and which use-cases answer for it. */
export interface City {
    config: CityConfig;
    create(env: Env): CityUseCases;
}
