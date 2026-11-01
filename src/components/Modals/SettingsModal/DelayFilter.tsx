import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { usePreferencesStore } from '@/state/preferencesStore';
import { DELAY_TIERS, type DelayTierKey } from '@/config/transit';
import { toggled } from '@/lib/strings';
import { FilterChip } from '@/components/FilterChip';
import { FilterGroup } from './SettingsControls';

const DELAY_TIER_DOTS: Record<DelayTierKey, string> = {
    aheadOfTime: 'bg-sky-500 dark:bg-sky-400',
    onTime: 'bg-emerald-600 dark:bg-emerald-400',
    moderate: 'bg-amber-600 dark:bg-amber-400',
    high: 'bg-rose-600 dark:bg-rose-400',
    severe: 'bg-purple-700 dark:bg-purple-400',
};

/** Which delay tiers the map shows; an empty filter shows them all. */
export const DelayFilter = () => {
    const { t } = useTranslation();
    const delayFilter = usePreferencesStore(s => s.delayFilter);
    const { setDelayFilter } = usePreferencesStore(s => s.actions);

    return (
        <FilterGroup
            title={t('settings.colorVehiclesByDelay.filterTitle')}
            action={delayFilter.length > 0 && (
                <Button variant="link" size="inline" onClick={() => setDelayFilter([])}>
                    {t('common.all')}
                </Button>
            )}
        >
            {DELAY_TIERS.map(({ key }) => (
                <FilterChip
                    key={key}
                    label={t(`settings.colorVehiclesByDelay.${key}`)}
                    isActive={delayFilter.includes(key)}
                    isDimmed={delayFilter.length > 0}
                    onClick={() => setDelayFilter(toggled(delayFilter, key))}
                    dotClassName={DELAY_TIER_DOTS[key]}
                />
            ))}
        </FilterGroup>
    );
};
