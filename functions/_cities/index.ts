import type { Env } from '../_core/types';
import type { CityConfig } from '../_core/city-config';
import type { CityUseCases } from '../_domain/use-cases';
import type { City } from './types';
import { city as prague } from './prague';
import { city as brno } from './brno';
import { city as presov } from './presov';
import { city as duk } from './duk';

/** Every city's declaration lives in its own file here; this is the lookup by slug. */
const CITIES: Record<string, City> = { prague, brno, presov, duk };

export const CITY_REGISTRY: Record<string, CityConfig> = Object.fromEntries(
    Object.entries(CITIES).map(([slug, city]) => [slug, city.config])
);

export function getCityConfig(slug: string): CityConfig | null {
    return CITY_REGISTRY[slug] ?? null;
}

export function getCity(slug: string): City | null {
    return CITIES[slug] ?? null;
}

const built = new WeakMap<Env, Map<City, CityUseCases>>();

/** A city's use-cases, built once per `env`: they hold no request state, so requests share them. */
export function useCasesOf(city: City, env: Env): CityUseCases {
    let byCity = built.get(env);
    if (!byCity) {
        byCity = new Map();
        built.set(env, byCity);
    }
    let useCases = byCity.get(city);
    if (!useCases) {
        useCases = city.create(env);
        byCity.set(city, useCases);
    }
    return useCases;
}

/** The use-cases that answer for a city. Throws for a slug that is not registered. */
export function getCityUseCases(slug: string, env: Env): CityUseCases {
    const city = getCity(slug);
    if (!city) throw new Error(`Unknown city: ${slug}`);
    return useCasesOf(city, env);
}
