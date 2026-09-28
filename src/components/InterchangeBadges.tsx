import { Bus, CableCar, Plane, Ship, Train, TramFront, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LineBadge } from './LineBadge';
import { useRouteMetadata } from '@/hooks/data/useRouteMetadata';
import { routeJoinKey } from '@/utils/routeTypes';
import { metroLineOf } from '@/utils/interchanges';
import { FALLBACK_ROUTE_COLOR } from '@/config/constants';

/** Mode icon and its `transportModes` label key for each non-metro code; codes sharing an icon render once. */
const MODE_ICONS: Record<string, { icon: LucideIcon; label: string }> = {
    Ra: { icon: Train, label: 'train' },
    Sb: { icon: Train, label: 'train' },
    Fu: { icon: CableCar, label: 'funicular' },
    Fe: { icon: Ship, label: 'ferry' },
    Ap: { icon: Plane, label: 'airport' },
    Tw: { icon: TramFront, label: 'tram' },
    Tb: { icon: Bus, label: 'trolleybus' },
    Bu: { icon: Bus, label: 'bus' },
};

/**
 * InterchangeBadges
 *
 * Metro line badges and mode icons for the interchanges at a stop.
 */
export const InterchangeBadges = ({ codes }: { codes: readonly string[] }) => {
    const { t } = useTranslation();
    const { byShortName } = useRouteMetadata();
    if (codes.length === 0) return null;

    const seenIcons = new Set<LucideIcon>();
    return (
        <span className="flex items-center gap-1 shrink-0">
            {codes.map(code => {
                const metroLine = metroLineOf(code);
                if (metroLine) {
                    const color = byShortName.get(routeJoinKey('metro', metroLine))?.route_color ?? FALLBACK_ROUTE_COLOR;
                    return <LineBadge key={code} name={metroLine} routeColor={color} />;
                }
                const mode = MODE_ICONS[code];
                if (!mode || seenIcons.has(mode.icon)) return null;
                seenIcons.add(mode.icon);
                const Icon = mode.icon;
                const label = t(`transportModes.${mode.label}`);
                return <Icon key={code} size={14} strokeWidth={1.75} className="text-muted-foreground" aria-label={label}><title>{label}</title></Icon>;
            })}
        </span>
    );
};
