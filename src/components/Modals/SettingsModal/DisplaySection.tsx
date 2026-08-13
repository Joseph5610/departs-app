import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'next-themes';
import {
    Eye,
    EyeOff,
    MapPin,
    TrainFront as Subway,
    Bus,
    TramFront as Tram,
    Train,
    Ship,
    CableCar,
    CircleSlash,
    Type,
    Map as MapIcon,
    Sun,
    Moon,
    Monitor,
    Palette,
    Ticket,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Toggle } from '@/components/ui/toggle';
import { Item, ItemMedia, ItemContent, ItemTitle, ItemDescription, ItemActions } from '@/components/ui/item';

import { cn } from '@/lib/utils';
import { usePreferencesStore } from '../../../state/preferencesStore';
import { useCities } from '../../../hooks/data/useCities';
import { FRONTEND_CITIES_CONFIG } from '../../../config/cities';

const vehicleTypes = [
    { id: 'metro', icon: Subway },
    { id: 'tram', icon: Tram },
    { id: 'bus', icon: Bus },
    { id: 'trolleybus', icon: Bus },
    { id: 'train', icon: Train },
    { id: 'ferry', icon: Ship },
    { id: 'funicular', icon: CableCar }
];

interface FilterButtonProps {
    id?: string;
    icon: React.ElementType;
    label: string;
    isActive: boolean;
    onClick: () => void;
    variant?: 'primary' | 'amber';
    testId?: string;
}

const FilterButton: React.FC<FilterButtonProps> = ({ icon: Icon, label, isActive, onClick, testId }) => (
    <Toggle
        pressed={isActive}
        onPressedChange={onClick}
        variant="outline"
        data-testid={testId}
        className={cn(
            "h-auto flex flex-col items-center justify-center gap-1.5 px-3 py-2.5 rounded-2xl transition-[transform,colors] text-sm font-semibold active:scale-95 group",
            // The border is border-border/80 so it's subtle but visible
            "border-border/80 hover:bg-foreground/10 hover:text-foreground",
            // Use highly specific overrides for the ON state to defeat shadcn's default bg-muted
            "data-[state=on]:bg-primary/20! data-[state=on]:text-primary! data-[state=on]:border-primary/50! data-[state=on]:shadow-[0_0_12px_rgba(var(--color-primary),0.15)]",
            // Ensure OFF state doesn't look completely transparent if we don't want it to, or just leave it
            "data-[state=off]:bg-transparent data-[state=off]:text-foreground/70"
        )}
    >
        <Icon size={18} className={cn("transition-transform duration-300", isActive ? 'scale-110 opacity-100' : 'group-hover:scale-110 opacity-70')} />
        <span className="text-[10px] font-bold uppercase tracking-wider">
            {label}
        </span>
    </Toggle>
);

interface DelayFilterCardProps {
    label: string;
    isActive: boolean;
    onClick: () => void;
    accentClass: string;
    activeBg: string;
    activeBorder: string;
    activeText: string;
}

const DelayFilterCard: React.FC<DelayFilterCardProps> = ({
    label,
    isActive,
    onClick,
    accentClass,
    activeBg,
    activeBorder,
    activeText
}) => (
    <button
        type="button"
        onClick={onClick}
        className={cn(
            "relative flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer text-left select-none outline-none group active:scale-[0.98]",
            isActive
                ? cn("shadow-2xs", activeBg, activeBorder, activeText)
                : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
        )}
    >
        <div
            className={cn(
                "w-1 h-5 rounded-full transition-all shrink-0",
                accentClass,
                isActive ? "opacity-100 scale-100" : "opacity-30 group-hover:opacity-60"
            )}
        />
        <span className="text-xs font-semibold tracking-tight truncate">
            {label}
        </span>
    </button>
);

interface ToggleSectionProps {
    title: string;
    description: string;
    icon: React.ElementType;
    isChecked: boolean;
    onToggle: (val: boolean) => void;
    children?: React.ReactNode;
    className?: string;
}

const ToggleSection: React.FC<ToggleSectionProps> = ({ title, description, icon: Icon, isChecked, onToggle, children, className }) => (
    <Card variant="subtle" size="none" className={className}>
        <Item
            variant="settings"
            size="none"
            className={cn(
                "w-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset border-0",
                !isChecked && "rounded-xl",
                isChecked && "rounded-t-xl"
            )}
            render={<button onClick={() => onToggle(!isChecked)} />}
        >
            <ItemMedia variant="icon" className={cn(isChecked ? "text-primary" : "text-muted-foreground")}>
                <Icon size={20} strokeWidth={1.5} />
            </ItemMedia>
            <ItemContent>
                <ItemTitle className="text-foreground">{title}</ItemTitle>
                <ItemDescription className="text-xs">{description}</ItemDescription>
            </ItemContent>
            <ItemActions>
                <Switch
                    checked={isChecked}
                    onCheckedChange={onToggle}
                    className="ml-3 sm:ml-4"
                />
            </ItemActions>
        </Item>

        {children && (
            <div 
                className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out border-t border-border/50",
                    isChecked ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none border-t-0"
                )}
            >
                <div className="overflow-hidden flex flex-col">
                    {children}
                </div>
            </div>
        )}
    </Card>
);

/**
 * DisplaySection
 *
 * Renders vehicle/stop visibility toggles and the vehicle type filter grid.
 */
export const DisplaySection: React.FC = () => {
    const { t } = useTranslation();
    const { theme, setTheme } = useTheme();

    // Preferences
    const showVehicles = usePreferencesStore(s => s.showVehicles);
    const showStops = usePreferencesStore(s => s.showStops);
    const routeTypeFilter = usePreferencesStore(s => s.routeTypeFilter);
    const stopTypeFilter = usePreferencesStore(s => s.stopTypeFilter);
    const showStopLabels = usePreferencesStore(s => s.showStopLabels);
    const showPointsOfSale = usePreferencesStore(s => s.showPointsOfSale);
    const mapBaseStyle = usePreferencesStore(s => s.mapBaseStyle);
    const colorVehiclesByDelay = usePreferencesStore(s => s.colorVehiclesByDelay);
    const delayFilter = usePreferencesStore(s => s.delayFilter);

    const {
        setShowVehicles,
        setShowStops,
        setShowPointsOfSale,
        setRouteTypeFilter,
        setStopTypeFilter,
        setShowStopLabels,
        setMapBaseStyle,
        setColorVehiclesByDelay,
        setDelayFilter,
    } = usePreferencesStore(s => s.actions);

    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const { data: citiesData } = useCities();
    const cityConfig = citiesData?.cities.find(c => c.slug === selectedCity) || FRONTEND_CITIES_CONFIG[selectedCity];

    const allowedVehicles = cityConfig?.filters?.vehicles || vehicleTypes.map(v => v.id);
    const allowedStops = cityConfig?.filters?.stops || [];
    const isStopsFilterEnabled = allowedStops.length > 0;

    const toggleFilter = (filter: string[], setFilter: (val: string[]) => void, type: string) => {
        if (filter.includes(type)) {
            setFilter(filter.filter(t => t !== type));
        } else {
            setFilter([...filter, type]);
        }
    };

    const toggleDelayTier = (tierKey: string) => {
        if (delayFilter.includes(tierKey)) {
            const next = delayFilter.filter(k => k !== tierKey);
            setDelayFilter(next);
        } else {
            setDelayFilter([...delayFilter, tierKey]);
        }
    };

    const isDelayTierActive = (tierKey: string) => {
        return delayFilter.length === 0 || delayFilter.includes(tierKey);
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Theme / Appearance Selection */}
            <div className="flex flex-col gap-3">
                <h3 className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest px-1">
                    {t('settings.theme.title')}
                </h3>
                <Card variant="subtle" size="none">
                    <div className="p-3">
                        <div className="grid grid-cols-3 gap-2">
                            <FilterButton
                                icon={Sun}
                                label={t('settings.theme.light')}
                                isActive={theme === 'light'}
                                onClick={() => setTheme('light')}
                                testId="theme-light"
                            />
                            <FilterButton
                                icon={Moon}
                                label={t('settings.theme.dark')}
                                isActive={theme === 'dark'}
                                onClick={() => setTheme('dark')}
                                testId="theme-dark"
                            />
                            <FilterButton
                                icon={Monitor}
                                label={t('settings.theme.system')}
                                isActive={theme === 'system'}
                                onClick={() => setTheme('system')}
                                testId="theme-system"
                            />
                        </div>
                    </div>
                </Card>
            </div>

            <div className="flex flex-col gap-3">
                <h3 className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest px-1">
                    {t('settings.sections.display')}
                </h3>
            <ToggleSection
                title={t('settings.liveVehicles.title')}
                description={t('settings.liveVehicles.description')}
                icon={showVehicles ? Eye : EyeOff}
                isChecked={showVehicles}
                onToggle={setShowVehicles}
            >
                <div className="flex flex-col gap-5 px-4 py-3">
                    {/* Vehicle Type Filters */}
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-primary" />
                            <div className="text-muted-foreground text-[10px] uppercase font-bold tracking-[0.2em]">
                                {t('settings.sections.filters')}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 min-[400px]:grid-cols-3 sm:grid-cols-4 gap-2">
                            {vehicleTypes
                                .filter(({ id }) => allowedVehicles.includes(id))
                                .map(({ id, icon }) => (
                                <FilterButton
                                    key={id}
                                    icon={icon}
                                    label={t(`settings.vehicleTypes.${id}`)}
                                    isActive={routeTypeFilter.includes(id)}
                                    onClick={() => toggleFilter(routeTypeFilter, setRouteTypeFilter, id)}
                                    testId={`vehicle-type-${id}`}
                                />
                            ))}

                            <FilterButton
                                icon={CircleSlash}
                                label={t('common.all')}
                                isActive={routeTypeFilter.length === 0}
                                onClick={() => setRouteTypeFilter([])}
                                variant="amber"
                            />
                        </div>
                    </div>

                    {/* Delay Range Filters */}
                    <div className="flex flex-col gap-3 border-t border-border/40 pt-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-1 h-1 rounded-full bg-primary" />
                                <div className="text-muted-foreground text-[10px] uppercase font-bold tracking-[0.2em]">
                                    {t('settings.colorVehiclesByDelay.filterTitle')}
                                </div>
                            </div>
                            {delayFilter.length > 0 && (
                                <button
                                    onClick={() => setDelayFilter([])}
                                    className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                                >
                                    {t('common.all')}
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <DelayFilterCard
                                label={t('settings.colorVehiclesByDelay.aheadOfTime')}
                                isActive={isDelayTierActive('aheadOfTime')}
                                onClick={() => toggleDelayTier('aheadOfTime')}
                                accentClass="bg-sky-500 dark:bg-sky-400"
                                activeBg="bg-sky-500/10 dark:bg-sky-500/20"
                                activeBorder="border-sky-500/40 dark:border-sky-500/50"
                                activeText="text-sky-950 dark:text-sky-300"
                            />

                            <DelayFilterCard
                                label={t('settings.colorVehiclesByDelay.onTime')}
                                isActive={isDelayTierActive('onTime')}
                                onClick={() => toggleDelayTier('onTime')}
                                accentClass="bg-emerald-600 dark:bg-emerald-400"
                                activeBg="bg-emerald-500/10 dark:bg-emerald-500/20"
                                activeBorder="border-emerald-500/40 dark:border-emerald-500/50"
                                activeText="text-emerald-950 dark:text-emerald-300"
                            />

                            <DelayFilterCard
                                label={t('settings.colorVehiclesByDelay.moderate')}
                                isActive={isDelayTierActive('moderate')}
                                onClick={() => toggleDelayTier('moderate')}
                                accentClass="bg-amber-600 dark:bg-amber-400"
                                activeBg="bg-amber-500/10 dark:bg-amber-500/20"
                                activeBorder="border-amber-500/40 dark:border-amber-500/50"
                                activeText="text-amber-950 dark:text-amber-300"
                            />

                            <DelayFilterCard
                                label={t('settings.colorVehiclesByDelay.high')}
                                isActive={isDelayTierActive('high')}
                                onClick={() => toggleDelayTier('high')}
                                accentClass="bg-rose-600 dark:bg-rose-400"
                                activeBg="bg-rose-500/10 dark:bg-rose-500/20"
                                activeBorder="border-rose-500/40 dark:border-rose-500/50"
                                activeText="text-rose-950 dark:text-rose-300"
                            />

                            <DelayFilterCard
                                label={t('settings.colorVehiclesByDelay.severe')}
                                isActive={isDelayTierActive('severe')}
                                onClick={() => toggleDelayTier('severe')}
                                accentClass="bg-purple-700 dark:bg-purple-400"
                                activeBg="bg-purple-500/10 dark:bg-purple-950/40"
                                activeBorder="border-purple-500/40 dark:border-purple-500/50"
                                activeText="text-purple-950 dark:text-purple-200"
                            />
                        </div>
                    </div>
                </div>
            </ToggleSection>

            <Card variant="subtle" size="none" className="mt-3">
                <Item
                    variant="settings"
                    size="none"
                    className="w-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-xl border-0"
                    render={<button onClick={() => setColorVehiclesByDelay(!colorVehiclesByDelay)} />}
                >
                    <ItemMedia variant="icon" className={cn(colorVehiclesByDelay ? "text-primary" : "text-muted-foreground")}>
                        <Palette size={20} strokeWidth={1.5} />
                    </ItemMedia>
                    <ItemContent>
                        <ItemTitle className="text-foreground">{t('settings.colorVehiclesByDelay.title')}</ItemTitle>
                        <ItemDescription className="text-xs">{t('settings.colorVehiclesByDelay.description')}</ItemDescription>
                    </ItemContent>
                    <ItemActions>
                        <Switch
                            checked={colorVehiclesByDelay}
                            onCheckedChange={setColorVehiclesByDelay}
                            className="ml-3 sm:ml-4"
                        />
                    </ItemActions>
                </Item>
            </Card>

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
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-primary" />
                            <div className="text-muted-foreground text-[10px] uppercase font-bold tracking-[0.2em]">
                                {t('settings.sections.filters')}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 min-[400px]:grid-cols-3 sm:grid-cols-4 gap-2">
                            {allowedStops.includes('metro') && (
                                <FilterButton
                                    icon={Subway}
                                    label={t('settings.vehicleTypes.metro')}
                                    isActive={stopTypeFilter.includes('metro')}
                                    onClick={() => toggleFilter(stopTypeFilter, setStopTypeFilter, 'metro')}
                                />
                            )}

                            {allowedStops.includes('train') && (
                                <FilterButton
                                    icon={Train}
                                    label={t('settings.vehicleTypes.train')}
                                    isActive={stopTypeFilter.includes('train')}
                                    onClick={() => toggleFilter(stopTypeFilter, setStopTypeFilter, 'train')}
                                />
                            )}

                            <FilterButton
                                icon={CircleSlash}
                                label={t('common.all')}
                                isActive={stopTypeFilter.length === 0}
                                onClick={() => setStopTypeFilter([])}
                                variant="amber"
                            />
                            <div className="hidden sm:block" />
                        </div>
                    </div>
                )}
            </ToggleSection>

            {cityConfig?.hasPointsOfSale && (
                <Card variant="subtle" size="none" className="mt-3">
                    <Item
                        variant="settings"
                        size="none"
                        className="w-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-xl border-0"
                        render={<button onClick={() => setShowPointsOfSale(!showPointsOfSale)} />}
                    >
                        <ItemMedia variant="icon" className={cn(showPointsOfSale ? "text-primary" : "text-muted-foreground")}>
                            <Ticket size={20} strokeWidth={1.5} />
                        </ItemMedia>
                        <ItemContent>
                            <ItemTitle className="text-foreground">{t('settings.showPointsOfSale.title')}</ItemTitle>
                            <ItemDescription className="text-xs">{t('settings.showPointsOfSale.description')}</ItemDescription>
                        </ItemContent>
                        <ItemActions>
                            <Switch
                                checked={showPointsOfSale}
                                onCheckedChange={setShowPointsOfSale}
                                className="ml-3 sm:ml-4"
                            />
                        </ItemActions>
                    </Item>
                </Card>
            )}

            <Card variant="subtle" size="none" className="mt-3">
                <Item
                    variant="settings"
                    size="none"
                    className="w-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-xl border-0"
                    render={<button onClick={() => setMapBaseStyle(mapBaseStyle === 'labels' ? 'nolabels' : 'labels')} />}
                >
                    <ItemMedia variant="icon" className={cn(mapBaseStyle === 'labels' ? "text-primary" : "text-muted-foreground")}>
                        <MapIcon size={20} strokeWidth={1.5} />
                    </ItemMedia>
                    <ItemContent>
                        <ItemTitle className="text-foreground">{t('settings.mapStyle.title')}</ItemTitle>
                        <ItemDescription className="text-xs">{t('settings.mapStyle.description')}</ItemDescription>
                    </ItemContent>
                    <ItemActions>
                        <Switch
                            checked={mapBaseStyle === 'labels'}
                            onCheckedChange={(c) => setMapBaseStyle(c ? 'labels' : 'nolabels')}
                            className="ml-3 sm:ml-4"
                        />
                    </ItemActions>
                </Item>
            </Card>
            </div>
        </div>
    );
};

DisplaySection.displayName = 'DisplaySection';

