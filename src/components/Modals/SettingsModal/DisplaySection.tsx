import { useTranslation } from 'react-i18next';
import { useTheme } from 'next-themes';
import {
    Eye,
    EyeOff,
    MapPin,
    CircleSlash,
    Type,
    Map as MapIcon,
    Sun,
    Moon,
    Monitor,
    Palette,
    Ticket,
    Timer,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Item, ItemMedia, ItemContent, ItemTitle, ItemDescription, ItemActions } from '@/components/ui/item';

import { cn } from 'cn';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useCityConfig } from '@/hooks/data/useCities';
import { ROUTE_TYPE_ORDER } from '@/config/transit';
import { ROUTE_TYPE_ICONS } from '@/components/routeTypeIcons';
import { RefreshIntervalPicker } from '@/components/RefreshIntervalPicker';
import { toggled } from '@/lib/strings';
import { FilterButton, FilterHeading, SectionHeading, ToggleSection } from './SettingsControls';
import { DelayFilter } from './DelayFilter';

const vehicleTypes = ROUTE_TYPE_ORDER.map(id => ({ id, icon: ROUTE_TYPE_ICONS[id as keyof typeof ROUTE_TYPE_ICONS] }));

const THEMES = [
    { id: 'light', icon: Sun },
    { id: 'dark', icon: Moon },
    { id: 'system', icon: Monitor },
] as const;

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
    const mapBaseStyle = usePreferencesStore(s => s.mapBaseStyle);
    const colorVehiclesByDelay = usePreferencesStore(s => s.colorVehiclesByDelay);

    const {
        setShowVehicles,
        setShowStops,
        setShowPointsOfSale,
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
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
                <SectionHeading>{t('settings.theme.title')}</SectionHeading>
                <Card variant="subtle" size="none">
                    <div className="p-3">
                        <div className="grid grid-cols-3 gap-2">
                            {THEMES.map(({ id, icon }) => (
                                <FilterButton
                                    key={id}
                                    icon={icon}
                                    label={t(`settings.theme.${id}`)}
                                    isActive={theme === id}
                                    onClick={() => setTheme(id)}
                                    testId={`theme-${id}`}
                                />
                            ))}
                        </div>
                    </div>
                </Card>
            </div>

            <div className="flex flex-col gap-3">
                <SectionHeading>{t('settings.sections.data')}</SectionHeading>
                <Card variant="subtle" size="none">
                    <Item variant="settings" size="none" className="flex-nowrap hover:bg-transparent active:bg-transparent">
                        <ItemMedia variant="icon" className="text-muted-foreground">
                            <Timer size={20} strokeWidth={1.5} />
                        </ItemMedia>
                        <ItemContent className="min-w-0">
                            <ItemTitle className="text-foreground">{t('settings.refreshInterval.title')}</ItemTitle>
                            <ItemDescription className="text-xs">{t('settings.refreshInterval.description')}</ItemDescription>
                        </ItemContent>
                        <ItemActions>
                            <RefreshIntervalPicker className="w-36" />
                        </ItemActions>
                    </Item>
                </Card>
            </div>

            <div className="flex flex-col gap-3">
                <SectionHeading>{t('settings.sections.display')}</SectionHeading>
                <ToggleSection
                    title={t('settings.liveVehicles.title')}
                    description={t('settings.liveVehicles.description')}
                    icon={showVehicles ? Eye : EyeOff}
                    isChecked={showVehicles}
                    onToggle={setShowVehicles}
                >
                    <div className="flex flex-col gap-5 px-4 py-3">
                        <div className="flex flex-col gap-3">
                            <FilterHeading>{t('settings.sections.filters')}</FilterHeading>
                            <div className="grid grid-cols-2 min-[400px]:grid-cols-3 sm:grid-cols-4 gap-2">
                                {vehicleTypes
                                    .filter(({ id }) => allowedVehicles.includes(id))
                                    .map(({ id, icon }) => (
                                        <FilterButton
                                            key={id}
                                            icon={icon}
                                            label={t(`settings.vehicleTypes.${id}`)}
                                            isActive={routeTypeFilter.includes(id)}
                                            onClick={() => setRouteTypeFilter(toggled(routeTypeFilter, id))}
                                            testId={`vehicle-type-${id}`}
                                        />
                                    ))}

                                <FilterButton
                                    icon={CircleSlash}
                                    label={t('common.all')}
                                    isActive={routeTypeFilter.length === 0}
                                    onClick={() => setRouteTypeFilter([])}
                                />
                            </div>
                        </div>

                        <DelayFilter />
                    </div>
                </ToggleSection>

                <ToggleSection
                    title={t('settings.colorVehiclesByDelay.title')}
                    description={t('settings.colorVehiclesByDelay.description')}
                    icon={Palette}
                    isChecked={colorVehiclesByDelay}
                    onToggle={setColorVehiclesByDelay}
                    className="mt-3"
                />

                <ToggleSection
                    title={t('settings.showStops.title')}
                    description={t('settings.showStops.description')}
                    icon={MapPin}
                    isChecked={showStops}
                    onToggle={setShowStops}
                    className="mt-3"
                >
                    <Item
                        variant="settings"
                        size="none"
                        className={cn("w-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-none", isStopsFilterEnabled ? "border-b border-border/50" : "border-0")}
                        render={<button onClick={() => setShowStopLabels(!showStopLabels)} />}
                    >
                        <ItemMedia variant="icon" className={cn(showStopLabels ? "text-primary" : "text-muted-foreground")}>
                            <Type size={20} strokeWidth={1.5} />
                        </ItemMedia>
                        <ItemContent>
                            <ItemTitle className="text-foreground">{t('settings.showStops.labels')}</ItemTitle>
                            <ItemDescription className="text-[10px] font-normal">{t('settings.showStops.labelsDescription')}</ItemDescription>
                        </ItemContent>
                        <ItemActions>
                            <Switch
                                checked={showStopLabels}
                                onCheckedChange={setShowStopLabels}
                            />
                        </ItemActions>
                    </Item>

                    {isStopsFilterEnabled && (
                        <div className="flex flex-col gap-3 px-4 py-3">
                            <FilterHeading>{t('settings.sections.filters')}</FilterHeading>
                            <div className="grid grid-cols-2 min-[400px]:grid-cols-3 sm:grid-cols-4 gap-2">
                                {STOP_FILTER_TYPES.filter(type => allowedStops.includes(type)).map(type => (
                                    <FilterButton
                                        key={type}
                                        icon={ROUTE_TYPE_ICONS[type]}
                                        label={t(`settings.vehicleTypes.${type}`)}
                                        isActive={stopTypeFilter.includes(type)}
                                        onClick={() => setStopTypeFilter(toggled(stopTypeFilter, type))}
                                    />
                                ))}

                                <FilterButton
                                    icon={CircleSlash}
                                    label={t('common.all')}
                                    isActive={stopTypeFilter.length === 0}
                                    onClick={() => setStopTypeFilter([])}
                                />
                                <div className="hidden sm:block" />
                            </div>
                        </div>
                    )}
                </ToggleSection>

                {cityConfig.hasPointsOfSale && (
                    <ToggleSection
                        title={t('settings.showPointsOfSale.title')}
                        description={t('settings.showPointsOfSale.description')}
                        icon={Ticket}
                        isChecked={showPointsOfSale}
                        onToggle={setShowPointsOfSale}
                        className="mt-3"
                    />
                )}

                <ToggleSection
                    title={t('settings.mapStyle.title')}
                    description={t('settings.mapStyle.description')}
                    icon={MapIcon}
                    isChecked={mapBaseStyle === 'labels'}
                    onToggle={(c) => setMapBaseStyle(c ? 'labels' : 'nolabels')}
                    className="mt-3"
                />
            </div>
        </div>
    );
};
