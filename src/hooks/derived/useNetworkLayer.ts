import { useNetworkLines } from '@/hooks/data/useNetworkLines';
import { usePreferencesStore } from '@/state/preferencesStore';
import { colorNetwork, type ColoredNetwork } from '@/domain/routes';
import { modeColorsOf } from '@/lib/map/stopBadges';
import { memoizeLast } from '@/lib/memoize';

const colored = memoizeLast(colorNetwork);
const modeColors = memoizeLast(modeColorsOf);

/** The city's network as drawn: coloured by mode where a piece has no colour of its own; null when hidden or absent. */
export function useNetworkLayer(): ColoredNetwork | null {
    const network = useNetworkLines();
    const city = usePreferencesStore(s => s.selectedCity);
    const show = usePreferencesStore(s => s.showNetworkLines);
    return show && network ? colored(network, modeColors(city)) : null;
}
