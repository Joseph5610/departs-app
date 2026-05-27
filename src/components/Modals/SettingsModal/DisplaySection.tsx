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
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Box, Stack, HStack, Surface } from '@/components/ui/layout';
import { usePreferencesStore } from '../../../state/preferencesStore';

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

const FilterButton: React.FC<FilterButtonProps> = ({ icon: Icon, label, isActive, onClick, variant = 'primary', testId }) => (
    <button
        onClick={onClick}
        className={cn(
            "group relative px-3 py-2.5 rounded-2xl border transition-all active:scale-95 flex flex-col items-center justify-center gap-1.5 outline-none",
            isActive
                ? variant === 'primary' 
                    ? "bg-primary/20 border-primary/50 text-primary shadow-[0_0_12px_rgba(var(--color-primary),0.1)]"
                    : "bg-amber-500/20 border-amber-500/50 text-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.1)]"
                : "bg-muted/40 border text-foreground/80 hover:bg-white/10 hover:text-foreground"
        )}
        data-testid={testId}
    >
        <Icon size={18} className={cn("transition-transform duration-300", isActive ? 'scale-110 opacity-100' : 'group-hover:scale-110 opacity-70')} />
        <span className="text-[10px] font-bold uppercase tracking-wider">
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
    <Surface variant="tinted" className={cn("overflow-hidden", className)}>
        <button
            onClick={() => onToggle(!isChecked)}
            className="w-full flex items-center justify-between p-3.5 sm:p-4 hover:bg-white/10 active:bg-white/15 transition-all text-left group focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
            <HStack gap={4} className="min-w-0 flex-1">
                <Box className={cn(
                    "p-3 rounded-xl transition-colors shrink-0 hidden sm:flex",
                    isChecked ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                )}>
                    <Icon size={22} />
                </Box>
                <Stack gap={1} className="min-w-0 flex-1">
                    <h4 className="font-semibold leading-snug">{title}</h4>
                    <p className="text-muted-foreground text-xs leading-tight">{description}</p>
                </Stack>
            </HStack>

            <Switch
                checked={isChecked}
                onCheckedChange={onToggle}
                className="ml-3 sm:ml-4"
            />
        </button>

        <AnimatePresence>
            {isChecked && children && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden bg-foreground/2"
                >
                    <Stack gap={4} className="relative p-4 pt-2">
                        {children}
                    </Stack>
                </motion.div>
            )}
        </AnimatePresence>
    </Surface>
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

    const toggleFilter = (filter: string[], setFilter: (val: string[]) => void, type: string) => {
        if (filter.includes(type)) {
            setFilter(filter.filter(t => t !== type));
        } else {
            setFilter([...filter, type]);
        }
    };

    return (
        <Stack gap={3}>
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
                <Stack gap={4}>
                    <HStack gap={2} className="px-1">
                        <Box className="w-1 h-1 rounded-full bg-primary" />
                        <Box className="text-muted-foreground text-[10px] uppercase font-bold tracking-[0.2em]">
                            {t('settings.sections.filters')}
                        </Box>
                    </HStack>
                    <Box className="grid grid-cols-2 min-[400px]:grid-cols-3 sm:grid-cols-4 gap-2">
                        {vehicleTypes.map(({ id, icon }) => (
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
                    </Box>
                </Stack>
            </ToggleSection>

            <ToggleSection
                title={t('settings.showStops.title')}
                description={t('settings.showStops.description')}
                icon={MapPin}
                isChecked={showStops}
                onToggle={setShowStops}
                className="mt-3"
            >
                <Stack gap={3} className="px-1 border-b border-white/5 pb-4">
                    <HStack justify="between">
                        <HStack gap={3}>
                            <Box className={cn(
                                "p-2 rounded-lg transition-colors",
                                showStopLabels ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                            )}>
                                <Type size={18} />
                            </Box>
                            <Stack gap={1}>
                                <span className="text-sm font-semibold">{t('settings.showStops.labels')}</span>
                                <span className="text-[10px] text-muted-foreground leading-none">{t('settings.showStops.labelsDescription')}</span>
                            </Stack>
                        </HStack>
                        <Switch
                            checked={showStopLabels}
                            onCheckedChange={setShowStopLabels}
                        />
                    </HStack>
                </Stack>

                <Stack gap={4}>
                    <HStack gap={2} className="px-1">
                        <Box className="w-1 h-1 rounded-full bg-primary" />
                        <Box className="text-muted-foreground text-[10px] uppercase font-bold tracking-[0.2em]">
                            {t('settings.sections.filters')}
                        </Box>
                    </HStack>
                    <Box className="grid grid-cols-2 min-[400px]:grid-cols-3 sm:grid-cols-4 gap-2">
                        <FilterButton
                            icon={Subway}
                            label={t('settings.vehicleTypes.metro')}
                            isActive={stopTypeFilter.includes('metro')}
                            onClick={() => toggleFilter(stopTypeFilter, setStopTypeFilter, 'metro')}
                        />

                        <FilterButton
                            icon={Train}
                            label={t('settings.vehicleTypes.train')}
                            isActive={stopTypeFilter.includes('train')}
                            onClick={() => toggleFilter(stopTypeFilter, setStopTypeFilter, 'train')}
                        />

                        <FilterButton
                            icon={CircleSlash}
                            label={t('common.all')}
                            isActive={stopTypeFilter.length === 0}
                            onClick={() => setStopTypeFilter([])}
                            variant="amber"
                        />
                        <Box className="hidden sm:block" />
                    </Box>
                </Stack>
            </ToggleSection>

            <Surface variant="tinted" className="overflow-hidden mt-3">
                <button
                    onClick={() => setMapBaseStyle(mapBaseStyle === 'labels' ? 'nolabels' : 'labels')}
                    className="w-full flex items-center justify-between p-3.5 sm:p-4 hover:bg-white/10 active:bg-white/15 transition-all text-left group focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                >
                    <HStack gap={4}>
                        <Box className={cn(
                            "p-3 rounded-xl transition-colors shrink-0 hidden sm:flex",
                            mapBaseStyle === 'labels' ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                        )}>
                            <MapIcon size={22} />
                        </Box>
                        <Stack gap={1}>
                            <h4 className="font-semibold leading-snug">{t('settings.mapStyle.title')}</h4>
                            <p className="text-muted-foreground text-xs leading-tight">{t('settings.mapStyle.description')}</p>
                        </Stack>
                    </HStack>
                    <Switch
                        checked={mapBaseStyle === 'labels'}
                        onCheckedChange={(c) => setMapBaseStyle(c ? 'labels' : 'nolabels')}
                        className="ml-3 sm:ml-4"
                    />
                </button>
            </Surface>
        </Stack>
    );
};

DisplaySection.displayName = 'DisplaySection';

