import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
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
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useToast } from '../hooks/useToast';
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
    const { showToast } = useToast();
    const [isChecking, setIsChecking] = useState(false);
    const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const {
        needRefresh: [needRefresh],
    } = useRegisterSW();

    // Handle update detection during manual check
    useEffect(() => {
        if (isChecking && needRefresh) {
            showToast(t('settings.updates.available'), 'success');
            setIsChecking(false);
            if (checkTimerRef.current) {
                clearTimeout(checkTimerRef.current);
                checkTimerRef.current = null;
            }
        }
    }, [needRefresh, isChecking, showToast, t]);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (checkTimerRef.current) {
                clearTimeout(checkTimerRef.current);
            }
        };
    }, []);

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

        setIsChecking(true);
        showToast(t('settings.updates.checking'), 'info');

        try {
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.getRegistration();
                if (registration) {
                    await registration.update();

                    // Fallback timer if no update is found or already up to date
                    checkTimerRef.current = setTimeout(() => {
                        setIsChecking(false);
                        checkTimerRef.current = null;
                        if (!needRefresh) {
                            showToast(t('settings.updates.upToDate'), 'success');
                        }
                    }, 2000);
                    return;
                }
            }
            throw new Error('SW not found');
        } catch (error) {
            console.error('Update check failed', error);
            setIsChecking(false);
            showToast(t('settings.updates.upToDate'), 'success');
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent data-testid="settings-modal-content">
                <DialogHeader>
                    <DialogTitle>
                        {t('settings.title')}
                    </DialogTitle>
                </DialogHeader>
                <Stack gap={8} className="py-2">
                    {/* Live Vehicles Section */}
                    <Stack gap={3}>
                        <Box padding="none" className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest px-1">
                            {t('settings.sections.display')}
                        </Box>

                        <Surface variant="subtle" className="overflow-hidden">
                            <button
                                onClick={() => setShowVehicles(!showVehicles)}
                                className="w-full flex items-center justify-between p-3.5 sm:p-4 hover:bg-accent/50 active:bg-accent transition-all text-left group border-b border-border focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
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
                                                                    ? "bg-primary/15 border-primary/40 text-primary"
                                                                    : "bg-muted/20 border-border text-muted-foreground hover:bg-accent hover:border-accent hover:text-foreground"
                                                            )}
                                                            data-testid={`vehicle-type-${id}`}
                                                        >
                                                            <Icon size={18} className={cn("transition-transform duration-300", routeTypeFilter.includes(id) ? 'scale-110' : 'group-hover:scale-110 opacity-70')} />
                                                            <span className="text-[9px] font-bold uppercase tracking-wider">
                                                                {t(`settings.vehicleTypes.${id}`)}
                                                            </span>

                                                        </button>
                                                    ))}

                                                    <button
                                                        onClick={() => setRouteTypeFilter([])}
                                                        className={cn(
                                                            "px-3 py-2.5 rounded-2xl border transition-all active:scale-95 flex flex-col items-center justify-center gap-1.5 outline-none",
                                                            routeTypeFilter.length === 0
                                                                ? "bg-amber-500/15 border-amber-500/40 text-amber-500"
                                                                : "bg-muted/10 border-border text-muted-foreground hover:bg-accent hover:border-accent hover:text-foreground"
                                                        )}
                                                    >
                                                        <CircleSlash size={18} className={routeTypeFilter.length === 0 ? 'opacity-100' : 'opacity-70'} />
                                                        <span className="text-[9px] font-bold uppercase tracking-wider">
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

                        <Surface variant="subtle" className="overflow-hidden mt-3">
                            <button
                                onClick={() => setShowStops(!showStops)}
                                className="w-full flex items-center justify-between p-3.5 sm:p-4 hover:bg-accent/50 active:bg-accent transition-all text-left group focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
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
                                        "py-3 px-4 rounded-2xl border transition-all text-sm font-semibold outline-none",
                                        (i18n.resolvedLanguage || i18n.language).startsWith(lang)
                                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                                            : "bg-muted/30 border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                                    )}
                                >
                                    {t(`settings.language.${lang}`)}
                                </button>
                            ))}
                        </Box>
                    </Stack>

                    {/* Tip Box */}
                    <HStack className="p-3.5 sm:p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10 gap-2.5 sm:gap-3 items-start">
                        <Box className="shrink-0 text-amber-500/50 mt-0.5">
                            <Info size={16} />
                        </Box>
                        <Box className="text-muted-foreground text-xs leading-relaxed">
                            <span className="text-amber-200/80 font-bold">{t('settings.tip.prefix')}</span> {t('settings.tip.text')}
                        </Box>
                    </HStack>

                    {/* Footer Actions & Info */}
                    <Stack gap={6} className="pt-4 border-t border-border">
                        <Stack gap={3}>
                            {searchHistory.length > 0 && (
                                <button
                                    onClick={() => {
                                        clearHistory();
                                        showToast(t('settings.clearHistory.success'), 'success');
                                    }}
                                    className="flex items-center justify-between p-3.5 sm:p-4 bg-muted/30 hover:bg-accent active:scale-[0.98] rounded-2xl border border-border transition-all text-left focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <HStack gap={3}>
                                        <Box className="p-2 rounded-lg bg-destructive/10 text-destructive">
                                            <Clock size={18} />
                                        </Box>
                                        <span className="text-foreground text-sm font-medium">{t('settings.clearHistory.button')}</span>
                                    </HStack>
                                </button>
                            )}

                            <button
                                onClick={handleCheckUpdate}
                                disabled={isChecking}
                                className="flex items-center justify-between p-3.5 sm:p-4 bg-muted/30 hover:bg-accent active:scale-[0.98] rounded-2xl border border-border transition-all text-left outline-none"
                            >
                                <HStack gap={3}>
                                    <Box className="p-2 rounded-lg bg-muted text-muted-foreground">
                                        <RefreshCw size={18} className={isChecking ? 'animate-spin' : ''} />
                                    </Box>
                                    <span className="text-foreground text-sm font-medium">{t('settings.updates.check')}</span>
                                </HStack>
                                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest bg-accent px-2 py-1 rounded-md">
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
            </DialogContent>
        </Dialog>
    );
};
