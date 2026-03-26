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
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Box, Stack, HStack, Surface } from '@/components/ui/layout';

interface DisplaySectionProps {
    showVehicles: boolean;
    showStops: boolean;
    routeTypeFilter: string[];
    setShowVehicles: (v: boolean) => void;
    setShowStops: (v: boolean) => void;
    setRouteTypeFilter: (v: string[]) => void;
}

const vehicleTypes = [
    { id: 'metro', icon: Subway },
    { id: 'tram', icon: Tram },
    { id: 'bus', icon: Bus },
    { id: 'trolleybus', icon: Bus },
    { id: 'train', icon: Train },
    { id: 'ferry', icon: Ship },
    { id: 'funicular', icon: CableCar }
];

/**
 * DisplaySection
 *
 * Renders vehicle/stop visibility toggles and the vehicle type filter grid.
 * The filter grid is animated inside the vehicle toggle via framer-motion.
 */
export const DisplaySection: React.FC<DisplaySectionProps> = ({
    showVehicles,
    showStops,
    routeTypeFilter,
    setShowVehicles,
    setShowStops,
    setRouteTypeFilter
}) => {
    const { t } = useTranslation();

    const toggleRouteType = (type: string) => {
        if (routeTypeFilter.includes(type)) {
            setRouteTypeFilter(routeTypeFilter.filter(t => t !== type));
        } else {
            setRouteTypeFilter([...routeTypeFilter, type]);
        }
    };

    return (
        <Stack gap={3}>
            <Box padding="none" className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest px-1">
                {t('settings.sections.display')}
            </Box>

            <Surface variant="tinted" className="overflow-hidden">
                <button
                    onClick={() => setShowVehicles(!showVehicles)}
                    className="w-full flex items-center justify-between p-3.5 sm:p-4 hover:bg-white/10 active:bg-white/15 transition-all text-left group focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                >
                    <HStack gap={4} className="min-w-0 flex-1">
                        <Box className={cn(
                            "p-3 rounded-xl transition-colors shrink-0 hidden sm:flex",
                            showVehicles ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                        )}>
                            {showVehicles ? <Eye size={22} /> : <EyeOff size={22} />}
                        </Box>
                        <Stack gap={1} className="min-w-0 flex-1">
                            <div className="font-semibold leading-snug">
                                {t('settings.liveVehicles.title')}
                            </div>
                            <div className="text-muted-foreground text-xs leading-tight">
                                {t('settings.liveVehicles.description')}
                            </div>
                        </Stack>
                    </HStack>

                    <Switch
                        checked={showVehicles}
                        onCheckedChange={setShowVehicles}
                        className="ml-3 sm:ml-4"
                    />
                </button>

                <AnimatePresence>
                    {showVehicles && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden bg-foreground/[0.02]"
                        >
                            <Stack gap={4} className="relative p-4 pt-2">
                                <Stack gap={4}>
                                    <HStack gap={2} className="px-1">
                                        <Box className="w-1 h-1 rounded-full bg-primary" />
                                        <Box className="text-muted-foreground text-[10px] uppercase font-bold tracking-[0.2em]">
                                            {t('settings.sections.filters')}
                                        </Box>
                                    </HStack>
                                    <Box className="grid grid-cols-2 min-[400px]:grid-cols-3 sm:grid-cols-4 gap-2">
                                        {vehicleTypes.map(({ id, icon: Icon }) => (
                                            <button
                                                key={id}
                                                onClick={() => toggleRouteType(id)}
                                                className={cn(
                                                    "group relative px-3 py-2.5 rounded-2xl border transition-all active:scale-95 flex flex-col items-center justify-center gap-1.5 outline-none",
                                                    routeTypeFilter.includes(id)
                                                        ? "bg-primary/20 border-primary/50 text-primary shadow-[0_0_12px_rgba(var(--color-primary),0.1)]"
                                                        : "bg-muted/40 border text-foreground/80 hover:bg-white/10 hover:text-foreground"
                                                )}
                                                data-testid={`vehicle-type-${id}`}
                                            >
                                                <Icon size={18} className={cn("transition-transform duration-300", routeTypeFilter.includes(id) ? 'scale-110 opacity-100' : 'group-hover:scale-110 opacity-70')} />
                                                <span className="text-[10px] font-bold uppercase tracking-wider">
                                                    {t(`settings.vehicleTypes.${id}`)}
                                                </span>

                                            </button>
                                        ))}

                                        <button
                                            onClick={() => setRouteTypeFilter([])}
                                            className={cn(
                                                "px-3 py-2.5 rounded-2xl border transition-all active:scale-95 flex flex-col items-center justify-center gap-1.5 outline-none",
                                                routeTypeFilter.length === 0
                                                    ? "bg-amber-500/20 border-amber-500/50 text-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.1)]"
                                                    : "bg-muted/40 border text-foreground/80 hover:bg-white/10 hover:text-foreground"
                                            )}
                                        >
                                            <CircleSlash size={18} className={routeTypeFilter.length === 0 ? 'opacity-100' : 'opacity-70'} />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">
                                                {t('common.all')}
                                            </span>
                                        </button>
                                    </Box>
                                </Stack>
                            </Stack>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Surface>

            <Surface variant="tinted" className="overflow-hidden mt-3">
                <button
                    onClick={() => setShowStops(!showStops)}
                    className="w-full flex items-center justify-between p-3.5 sm:p-4 hover:bg-white/10 active:bg-white/15 transition-all text-left group focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                >
                    <HStack gap={4} className="min-w-0 flex-1">
                        <Box className={cn(
                            "p-3 rounded-xl transition-colors shrink-0 hidden sm:flex",
                            showStops ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                        )}>
                            <MapPin size={22} />
                        </Box>
                        <Stack gap={1} className="min-w-0 flex-1">
                            <div className="font-semibold leading-snug">
                                {t('settings.showStops.title')}
                            </div>
                            <div className="text-muted-foreground text-xs leading-tight">
                                {t('settings.showStops.description')}
                            </div>
                        </Stack>
                    </HStack>

                    <Switch
                        checked={showStops}
                        onCheckedChange={setShowStops}
                        className="ml-3 sm:ml-4"
                    />
                </button>
            </Surface>
        </Stack>
    );
};

DisplaySection.displayName = 'DisplaySection';
