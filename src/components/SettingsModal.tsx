import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
    Eye,
    EyeOff,
    Github,
    RefreshCw,
    Info,
    TrainFront as Subway,
    Bus,
    TramFront as Tram,
    Train,
    Ship,
    CableCar,
    CircleSlash,
    Database,
    MapPin,
    Clock
} from 'lucide-react';
import { version } from '../../package.json';
import { usePWA } from '../contexts/PWAContext';
import { toast } from 'sonner';
import { useMap } from '../hooks/useMap';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Box, Stack, HStack, Surface } from '@/components/ui/layout';

/**
 * SettingsModal
 *
 * Re-architected with semantic layout components.
 */
export const SettingsModal: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { state, actions } = useMap();

    const { isSettingsOpen: isOpen, showVehicles, showStops, routeTypeFilter, searchHistory } = state;
    const { setIsSettingsOpen, setShowVehicles, setShowStops, setRouteTypeFilter, clearHistory } = actions;

    const onClose = React.useCallback(() => {
        setIsSettingsOpen(false);
    }, [setIsSettingsOpen]);
    const [isChecking, setIsChecking] = useState(false);

    const { needRefresh } = usePWA();

    // Reset checking state if update is found
    React.useEffect(() => {
        if (needRefresh && isChecking) {
            setIsChecking(false);
        }
    }, [needRefresh, isChecking]);

    const toggleRouteType = (type: string) => {
        if (routeTypeFilter.includes(type)) {
            setRouteTypeFilter(routeTypeFilter.filter(t => t !== type));
        } else {
            setRouteTypeFilter([...routeTypeFilter, type]);
        }
    };

    const vehicleTypes = [
        { id: 'metro', icon: Subway },
        { id: 'tram', icon: Tram },
        { id: 'bus', icon: Bus },
        { id: 'trolleybus', icon: Bus },
        { id: 'train', icon: Train },
        { id: 'ferry', icon: Ship },
        { id: 'funicular', icon: CableCar }
    ];

    const handleCheckUpdate = async () => {
        if (isChecking) return;

        // If already need refresh, don't show another check
        if (needRefresh) {
            // PWAContext should have the toast visible
            return;
        }

        setIsChecking(true);

        try {
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.getRegistration();
                if (registration) {
                    await registration.update();
                    
                    // Wait to see if needRefresh becomes true (meaning update was found)
                    // If not after 2.5 seconds, we assume we are up to date
                    setTimeout(() => {
                        setIsChecking((currentChecking) => {
                            if (currentChecking) {
                                toast.success(t('settings.updates.upToDate'));
                                return false;
                            }
                            return false;
                        });
                    }, 2500);
                    return;
                }
            }
        } catch (error) {
            console.error('Update check failed', error);
        }
        
        setIsChecking(false);
        toast.success(t('settings.updates.upToDate'));
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent variant="tinted" data-testid="settings-modal-content" className="flex flex-col h-[calc(100dvh-2.5rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] p-0 overflow-hidden gap-0">
                <DialogHeader className="px-6 pt-6 shrink-0">
                    <DialogTitle>
                        {t('settings.title')}
                    </DialogTitle>
                </DialogHeader>
                <ScrollArea className="flex-1 min-h-0 px-6">
                    <Stack gap={8} className="py-2 pb-8">
                        {/* Live Vehicles Section */}
                        <Stack gap={3}>
                            <Box padding="none" className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest px-1">
                                {t('settings.sections.display')}
                            </Box>

                            <Surface variant="tinted" className="overflow-hidden border-white/15!">
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
                                                                        : "bg-muted/40 border-white/15! text-foreground/80 hover:bg-white/10 hover:border-white/25! hover:text-foreground"
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
                                                                    : "bg-muted/40 border-white/15! text-foreground/80 hover:bg-white/10 hover:border-white/25! hover:text-foreground"
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

                            <Surface variant="tinted" className="overflow-hidden mt-3 border-white/15!">
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

                        {/* Language Selection */}
                        <Stack gap={3}>
                            <Box className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest px-1">
                                {t('settings.sections.language')}
                            </Box>
                            <Box className="grid grid-cols-2 gap-3">
                                {(['en', 'cs'] as const).map((lang) => (
                                    <button
                                        key={lang}
                                        onClick={() => i18n.changeLanguage(lang)}
                                        className={cn(
                                            "py-3 px-4 rounded-2xl border transition-all text-sm font-semibold outline-none glassy-tinted",
                                            (i18n.resolvedLanguage || i18n.language).startsWith(lang)
                                                ? "ring-1 ring-primary/40 text-primary border-primary/20"
                                                : "border-white/5 text-muted-foreground hover:bg-white/5 hover:text-foreground"
                                        )}
                                    >
                                        {t(`settings.language.${lang}`)}
                                    </button>
                                ))}
                            </Box>
                        </Stack>

                        {/* Tip Box */}
                        <HStack className="p-3.5 sm:p-4 bg-amber-500/10 rounded-2xl border border-amber-500/30 gap-2.5 sm:gap-3 items-start">
                            <Box className="shrink-0 text-amber-500/70 mt-0.5">
                                <Info size={16} />
                            </Box>
                            <Box className="text-foreground/90 text-xs leading-relaxed font-medium">
                                <span className="text-amber-200 font-bold">{t('settings.tip.prefix')}</span> {t('settings.tip.text')}
                            </Box>
                        </HStack>

                        {/* Footer Actions & Info */}
                        <Stack gap={6}>
                            <Stack gap={3}>
                                {searchHistory.length > 0 && (
                                    <button
                                        onClick={() => {
                                            clearHistory();
                                            toast.success(t('settings.clearHistory.success'));
                                        }}
                                        className="flex items-center justify-between p-3.5 sm:p-4 bg-muted/40 hover:bg-white/10 active:bg-white/15 active:scale-[0.98] rounded-2xl border border-white/15! hover:border-destructive/30 transition-all text-left focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <HStack gap={3}>
                                            <Box className="p-2 rounded-lg bg-destructive/20 text-destructive">
                                                <Clock size={18} />
                                            </Box>
                                            <span className="text-foreground text-sm font-bold">{t('settings.clearHistory.button')}</span>
                                        </HStack>
                                    </button>
                                )}

                                <button
                                    onClick={handleCheckUpdate}
                                    disabled={isChecking}
                                    className="flex items-center justify-between p-3.5 sm:p-4 bg-muted/40 hover:bg-white/10 active:bg-white/15 active:scale-[0.98] rounded-2xl border border-white/15! transition-all text-left outline-none"
                                >
                                    <HStack gap={3}>
                                        <Box className="p-2 rounded-lg bg-white/10 text-foreground">
                                            <RefreshCw size={18} className={isChecking ? 'animate-spin' : ''} />
                                        </Box>
                                        <span className="text-foreground text-sm font-bold">
                                            {isChecking ? t('settings.updates.checking') : t('settings.updates.check')}
                                        </span>
                                    </HStack>
                                    <span className="text-[10px] text-foreground/70 font-bold uppercase tracking-widest bg-white/10 px-2 py-1 rounded-md">
                                        {t('settings.versionBadge', { version })}
                                    </span>
                                </button>

                                <HStack justify="center" gap={6}>
                                    <a
                                        href="https://golemio.cz"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 py-3 text-[10px] text-muted-foreground hover:text-primary transition-colors uppercase font-bold tracking-widest outline-none"
                                    >
                                        <Database size={14} />
                                        {t('settings.dataSource')}
                                    </a>

                                    <a
                                        href="https://github.com/joseph5610/departs-app"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 py-3 text-[10px] text-muted-foreground hover:text-primary transition-colors uppercase font-bold tracking-widest outline-none"
                                    >
                                        <Github size={14} />
                                        {t('settings.viewSource')}
                                    </a>
                                </HStack>
                            </Stack>
                        </Stack>
                    </Stack>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};
