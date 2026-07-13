import React from 'react';
import { useTranslation } from 'react-i18next';
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
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Toggle } from '@/components/ui/toggle';
import { Item, ItemMedia, ItemContent, ItemTitle, ItemDescription, ItemActions } from '@/components/ui/item';
import { motion, AnimatePresence } from 'framer-motion';
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
            "h-auto flex flex-col items-center justify-center gap-1.5 px-3 py-2.5 rounded-2xl border-white/5 transition-all text-sm font-semibold active:scale-95 group",
            "data-[state=on]:bg-primary/20 data-[state=on]:text-primary data-[state=on]:border-primary/50 data-[state=on]:shadow-[0_0_12px_rgba(var(--color-primary),0.1)]",
            "data-[state=off]:bg-muted/40 data-[state=off]:text-foreground/80 hover:bg-white/10 hover:text-foreground"
        )}
    >
        <Icon size={18} className={cn("transition-transform duration-300", isActive ? 'scale-110 opacity-100' : 'group-hover:scale-110 opacity-70')} />
        <span className="text-[10px] font-bold uppercase tracking-wider">
            {label}
        </span>
    </Toggle>
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
    <Card variant="subtle" className={cn("p-0 gap-0", className)}>
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

        <AnimatePresence>
            {isChecked && children && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-white/5"
                >
                    <div className="flex flex-col">
                        {children}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    </Card>
);

/**
 * DisplaySection
 *
 * Renders vehicle/stop visibility toggles and the vehicle type filter grid.
 */
export const DisplaySection: React.FC = () => {
    const { t } = useTranslation();

    // Preferences
    const showVehicles = usePreferencesStore(s => s.showVehicles);
    const showStops = usePreferencesStore(s => s.showStops);
    const routeTypeFilter = usePreferencesStore(s => s.routeTypeFilter);
    const stopTypeFilter = usePreferencesStore(s => s.stopTypeFilter);
    const showStopLabels = usePreferencesStore(s => s.showStopLabels);
    const mapBaseStyle = usePreferencesStore(s => s.mapBaseStyle);

    const {
        setShowVehicles,
        setShowStops,
        setRouteTypeFilter,
        setStopTypeFilter,
        setShowStopLabels,
        setMapBaseStyle
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

    return (
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
                <div className="flex flex-col gap-3 px-4 py-3">
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
            </ToggleSection>

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
                    className={cn("w-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-none", isStopsFilterEnabled ? "border-b border-white/5" : "border-0")}
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

            <Card variant="subtle" className="mt-3 p-0 gap-0">
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
    );
};

DisplaySection.displayName = 'DisplaySection';

