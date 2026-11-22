import { useTranslation } from 'react-i18next';
import { usePreferencesStore } from '@/state/preferencesStore';
import { DELAY_TIERS } from '@/config/transit';
import { toggled } from '@/lib/strings';
import { FilterChip } from '@/components/FilterChip';
import { FilterGroup } from './SettingsControls';

/** Which delay tiers the map shows, each dotted in its map colour; an empty filter shows them all. */
export const DelayFilter = () => {
    const { t } = useTranslation();
    const delayFilter = usePreferencesStore(s => s.delayFilter);
    const { setDelayFilter } = usePreferencesStore(s => s.actions);

    return (
        <FilterGroup title={t('settings.colorVehiclesByDelay.filterTitle')}>
            <FilterChip
                label={t('common.all')}
                isActive={delayFilter.length === 0}
                onClick={() => setDelayFilter([])}
            />
            {DELAY_TIERS.map(({ key, color }) => (
                <FilterChip
                    key={key}
                    label={t(`settings.colorVehiclesByDelay.${key}`)}
                    isActive={delayFilter.includes(key)}
                    onClick={() => setDelayFilter(toggled(delayFilter, key))}
                    dotColor={color}
                />
            ))}
        </FilterGroup>
    );
};
