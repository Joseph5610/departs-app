import { useTranslation } from 'react-i18next';
import { useTheme } from 'next-themes';
import {
    Eye,
    EyeOff,
    MapPin,
    
    Type,
    Map as MapIcon,
    Palette,
    Ticket,
    Construction,
    Timer,
    Waypoints,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Item, ItemActions, ItemMedia } from '@/components/ui/item';
import { SegmentedControl } from '@/components/SegmentedControl';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useCityConfig } from '@/hooks/data/useCities';
import { ROUTE_TYPE_ORDER } from '@/config/transit';
import { ROUTE_TYPE_ICONS } from '@/components/routeTypeIcons';
import { RefreshIntervalPicker } from '@/components/RefreshIntervalPicker';
import { toggled } from '@/lib/strings';
import { FilterChip } from '@/components/FilterChip';
import { FilterGroup, RowDetails, RowText, ToggleSection } from './SettingsControls';
import { SectionHeading } from '@/components/SectionHeading';
import { DelayFilter } from './DelayFilter';

const vehicleTypes = ROUTE_TYPE_ORDER.map(id => ({ id, icon: ROUTE_TYPE_ICONS[id as keyof typeof ROUTE_TYPE_ICONS] }));

const THEMES = ['light', 'dark', 'system'] as const;

/** Stop types a city may offer as a stop filter, in display order. */
const STOP_FILTER_TYPES = ['metro', 'train'] as const;

/** Theme, refresh interval and the map's layer toggles and filters. */
export const DisplaySection = () => {
    const { t } = useTranslation();
    const { theme, setTheme } = useTheme();

    const showVehicles = usePreferencesStore(s => s.showVehicles);
    const showStops = usePreferencesStore(s => s.showStops);
    const routeTypeFilter = usePreferencesStore(s => s.routeTypeFilter);
    const stopTypeFilter = usePreferencesStore(s => s.stopTypeFilter);
    const showStopLabels = usePreferencesStore(s => s.showStopLabels);
    const showPointsOfSale = usePreferencesStore(s => s.showPointsOfSale);
    const showAlertsOnMap = usePreferencesStore(s => s.showAlertsOnMap);
    const showNetworkLines = usePreferencesStore(s => s.showNetworkLines);
    const mapBaseStyle = usePreferencesStore(s => s.mapBaseStyle);
    const colorVehiclesByDelay = usePreferencesStore(s => s.colorVehiclesByDelay);

    const {
        setShowVehicles,
        setShowStops,
        setShowPointsOfSale,
        setShowAlertsOnMap,
        setShowNetworkLines,
        setRouteTypeFilter,
        setStopTypeFilter,
        setShowStopLabels,
        setMapBaseStyle,
        setColorVehiclesByDelay,
    } = usePreferencesStore(s => s.actions);

    const cityConfig = useCityConfig();

    const allowedVehicles = cityConfig.filters?.vehicles || vehicleTypes.map(v => v.id);
    const allowedStops = cityConfig.filters?.stops || [];
    const isStopsFilterEnabled = allowedStops.length > 0;

    return (
        <>
            <section className="flex flex-col gap-2">
                <SectionHeading>{t('settings.theme.title')}</SectionHeading>
                <SegmentedControl
                    fill
                    value={theme ?? 'system'}
                    onChange={setTheme}
                    options={THEMES.map(id => ({ value: id, label: t(`settings.theme.${id}`), testId: `theme-${id}` }))}
                />
            </section>

            <section className="flex flex-col gap-2">
                <SectionHeading>{t('settings.sections.data')}</SectionHeading>
                <Card size="none">
                    <Item variant="row" size="none" className="flex-wrap">
                        <ItemMedia variant="rowIcon" className="text-muted-foreground">
                            <Timer strokeWidth={1.75} />
                        </ItemMedia>
                        <RowText title={t('settings.refreshInterval.title')} description={t('settings.refreshInterval.description')} className="basis-36" />
                        <ItemActions className="ml-auto">
                            <RefreshIntervalPicker />
                        </ItemActions>
                    </Item>
                </Card>
            </section>

            <section className="flex flex-col gap-2">
                <SectionHeading>{t('settings.sections.display')}</SectionHeading>
                <div className="flex flex-col gap-5">
                    <Card size="none">
                        <ToggleSection
                            title={t('settings.liveVehicles.title')}
                            icon={showVehicles ? Eye : EyeOff}
                            isChecked={showVehicles}
                            onToggle={setShowVehicles}
                        >
                            <RowDetails>
                                <FilterGroup title={t('settings.liveVehicles.filterTitle')}>
                                    <FilterChip
                                        label={t('common.all')}
                                        isActive={routeTypeFilter.length === 0}
                                        onClick={() => setRouteTypeFilter([])}
                                    />
                                    {vehicleTypes
                                        .filter(({ id }) => allowedVehicles.includes(id))
                                        .map(({ id, icon }) => (
                                            <FilterChip
                                                key={id}
                                                icon={icon}
                                                label={t(`settings.vehicleTypes.${id}`)}
                                                isActive={routeTypeFilter.includes(id)}
                                                onClick={() => setRouteTypeFilter(toggled(routeTypeFilter, id))}
                                                testId={`vehicle-type-${id}`}
                                            />
                                        ))}
                                </FilterGroup>
                                <DelayFilter />
                            </RowDetails>
                        </ToggleSection>
                        <ToggleSection
                            title={t('settings.colorVehiclesByDelay.title')}
                            description={t('settings.colorVehiclesByDelay.description')}
                            icon={Palette}
                            isChecked={colorVehiclesByDelay}
                            onToggle={setColorVehiclesByDelay}
                        />
                    </Card>

                    <Card size="none">
                        <ToggleSection
                            title={t('settings.showStops.title')}
                            icon={MapPin}
                            isChecked={showStops}
                            onToggle={setShowStops}
                        >
                            <ToggleSection
                                title={t('settings.showStops.labels')}
                                icon={Type}
                                isChecked={showStopLabels}
                                onToggle={setShowStopLabels}
                            />
                            {isStopsFilterEnabled && (
                                <RowDetails>
                                    <FilterGroup title={t('settings.showStops.filterTitle')}>
                                        <FilterChip
                                            label={t('common.all')}
                                            isActive={stopTypeFilter.length === 0}
                                            onClick={() => setStopTypeFilter([])}
                                        />
                                        {STOP_FILTER_TYPES.filter(type => allowedStops.includes(type)).map(type => (
                                            <FilterChip
                                                key={type}
                                                icon={ROUTE_TYPE_ICONS[type]}
                                                label={t(`settings.vehicleTypes.${type}`)}
                                                isActive={stopTypeFilter.includes(type)}
                                                onClick={() => setStopTypeFilter(toggled(stopTypeFilter, type))}
                                            />
                                        ))}
                                    </FilterGroup>
                                </RowDetails>
                            )}
                        </ToggleSection>
                    </Card>

                    <Card size="none">
                        {cityConfig.hasNetworkLines && (
                            <ToggleSection
                                title={t('settings.showNetworkLines.title')}
                                icon={Waypoints}
                                isChecked={showNetworkLines}
                                onToggle={setShowNetworkLines}
                            />
                        )}
                        {cityConfig.hasAlertLocations && (
                            <ToggleSection
                                title={t('settings.showAlertsOnMap.title')}
                                icon={Construction}
                                isChecked={showAlertsOnMap}
                                onToggle={setShowAlertsOnMap}
                            />
                        )}
                        {cityConfig.hasPointsOfSale && (
                            <ToggleSection
                                title={t('settings.showPointsOfSale.title')}
                                icon={Ticket}
                                isChecked={showPointsOfSale}
                                onToggle={setShowPointsOfSale}
                            />
                        )}
                        <ToggleSection
                            title={t('settings.mapStyle.title')}
                            description={t('settings.mapStyle.description')}
                            icon={MapIcon}
                            isChecked={mapBaseStyle === 'labels'}
                            onToggle={(c) => setMapBaseStyle(c ? 'labels' : 'nolabels')}
                        />
                    </Card>
                </div>
            </section>
        </>
    );
};
