import { usePreferencesStore } from '@/state/preferencesStore';
import { useNowEvery } from '@/hooks/useNow';
import { FRONTEND_CITIES_CONFIG } from '@/config/cities';
import { lineRulesOf } from '@/domain/cities';
import { MAP_DATA } from '@/config/constants';
import { memoizeLast } from '@/lib/memoize';
import { nightLinesByNetwork, networksHidingNightLines, type HiddenNightLinesOf, type NightLineNetwork } from '@/domain/stops';

const NETWORKS: Record<string, NightLineNetwork> = Object.fromEntries(Object.entries(FRONTEND_CITIES_CONFIG).map(([slug, city]) =>
    [slug, { timeZone: city.timezone, nightHours: lineRulesOf(city.lineRules).nightHours }]));

const hidingAt = memoizeLast(networksHidingNightLines);
const byNetwork = memoizeLast(nightLinesByNetwork);

/** The night lines each stop's map badge leaves out now, by its network; changes only when a network's night hours start or end. */
export const useHiddenNightLines = (): HiddenNightLinesOf => {
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const now = useNowEvery(MAP_DATA.NIGHT_LINES_CHECK_MS);
    return byNetwork(hidingAt(now, NETWORKS), selectedCity);
};
