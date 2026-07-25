
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, LocateFixed, Plus, Minus, Compass, Star, AlertTriangle, BarChart3 } from 'lucide-react';
import { navigate } from 'wouter/use-browser-location';
import { useGlobalAlerts } from '../../hooks/data/useGlobalAlerts';
import { usePreferencesStore } from '../../state/preferencesStore';
import { useMapMetadataStore } from '../../state/mapMetadataStore';
import { useGeolocationStore } from '../../state/geolocationStore';
import { cn } from '@/lib/utils';
import { useGeolocation } from '../../hooks/features/useGeolocation';
import { Button } from '@/components/ui/button';
import { ButtonGroup, ButtonGroupSeparator } from '@/components/ui/button-group';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

import { useRouteParams } from '../../hooks/useRouteParams';

export const MapControls = React.memo(() => {
    const { t } = useTranslation();

    // Preferences Actions
    const { setIsSettingsOpen, setIsAlertsOpen } = usePreferencesStore(s => s.actions);
    const selectedCity = usePreferencesStore(s => s.selectedCity);

    // Routes
    const { isStatsRoute, isFavoritesRoute } = useRouteParams();

    const { rss } = useGlobalAlerts();
    const incidentsCount = React.useMemo(() => rss.data?.alerts?.filter(a => a.type === 'incident').length || 0, [rss.data]);

    // Geolocation Store
    const isGeoPending = useGeolocationStore(s => s.isGeoPending);
    const { handleLocate: onLocate } = useGeolocation();

    // Metadata Store
    const mapRef = useMapMetadataStore(s => s.mapRef);
    const mapLoaded = useMapMetadataStore(s => s.mapLoaded);
    const { easeTo, zoomIn, zoomOut } = useMapMetadataStore(s => s.actions);

    const onSettings = React.useCallback(() => {
        setIsSettingsOpen(true);
    }, [setIsSettingsOpen]);

    const onAlerts = React.useCallback(() => {
        setIsAlertsOpen(true);
    }, [setIsAlertsOpen]);

    const onStats = React.useCallback(() => {
        navigate(isStatsRoute ? `/${selectedCity}` : `/${selectedCity}/stats`);
    }, [isStatsRoute, selectedCity]);

    const onToggleFavorites = React.useCallback(() => {
        navigate(isFavoritesRoute ? `/${selectedCity}` : `/${selectedCity}/favorites`);
    }, [isFavoritesRoute, selectedCity]);



    const onZoomIn = React.useCallback(() => {
        zoomIn();
    }, [zoomIn]);

    const onZoomOut = React.useCallback(() => {
        zoomOut();
    }, [zoomOut]);

    const onResetBearing = React.useCallback(() => {
        easeTo({
            bearing: 0,
            duration: 1000,
            pitch: 0
        });
    }, [easeTo]);

    const [showCompass, setShowCompass] = useState(false);

    useEffect(() => {
        const map = mapRef.current?.getMap();
        if (!map) return;

        const updateCompass = () => {
            const bearing = map.getBearing();
            const pitch = map.getPitch();
            setShowCompass(Math.abs(bearing) > 0.5 || Math.abs(pitch) > 0.5);
        };

        map.on('rotate', updateCompass);
        map.on('pitch', updateCompass);
        updateCompass();

        return () => {
            map.off('rotate', updateCompass);
            map.off('pitch', updateCompass);
        };
    }, [mapRef, mapLoaded]);

    return (
        <div className="fixed top-0 md:top-5 right-0 safe-top safe-right p-4 md:p-0 md:right-5 z-40 pointer-events-none" data-testid="map-controls">
            <div className="flex flex-col gap-2 items-end pointer-events-auto">
                {/* Locate Button */}
                <ControlButton
                    onClick={(e) => onLocate(e)}
                    title={t('map.controls.myLocation')}
                    testId="map-locate-btn"
                    className="shadow-sm"
                >
                    <LocateFixed
                        size={20}
                        strokeWidth={1.5}
                        className={cn(
                            "transition-all",
                            isGeoPending ? "animate-spin text-primary" : "transition-transform"
                        )}
                     />
                </ControlButton>

                {/* Settings / Favorites Pill */}
                <ButtonGroup orientation="vertical" className="glassy rounded-full overflow-hidden shadow-sm">
                    <PillButton
                        onClick={onSettings}
                        title={t('map.controls.settings')}
                        testId="map-settings-btn"
                    >
                        <Settings size={20} strokeWidth={1.5} className="transition-transform hover:rotate-45" />
                    </PillButton>
                    <ButtonGroupSeparator orientation="horizontal" className="bg-border/50 mx-2" />
                    <PillButton
                        onClick={onAlerts}
                        title={t('alerts.title')}
                        testId="map-alerts-btn"
                    >
                        <AlertTriangle size={20} strokeWidth={1.5} className={cn(incidentsCount > 0 ? "text-destructive" : "transition-transform hover:scale-110")} />
                        {incidentsCount > 0 && (
                            <span className="absolute top-1 right-1 bg-destructive text-destructive-foreground text-[9px] font-bold px-1 py-0 rounded-full min-w-4 text-center shadow-sm pointer-events-none">
                                {incidentsCount}
                            </span>
                        )}
                    </PillButton>
                    <ButtonGroupSeparator orientation="horizontal" className="bg-border/50 mx-2" />
                    <PillButton
                        onClick={onToggleFavorites}
                        title={t('favorites.title')}
                        testId="map-favorites-btn"
                    >
                        <Star
                            size={20}
                            strokeWidth={1.5}
                            className={cn(
                                isFavoritesRoute ? "fill-primary text-primary" : "transition-transform hover:scale-110"
                            )}
                         />
                    </PillButton>
                    <ButtonGroupSeparator orientation="horizontal" className="bg-border/50 mx-2" />
                    <PillButton
                        onClick={onStats}
                        title={t('stats.title')}
                        testId="map-stats-btn"
                    >
                        <BarChart3
                            size={20}
                            strokeWidth={1.5}
                            className={cn(
                                isStatsRoute ? "text-primary" : "transition-transform hover:scale-110"
                            )}
                        />
                    </PillButton>
                </ButtonGroup>

                {/* Zoom Pill */}
                <ButtonGroup orientation="vertical" className="glassy rounded-full overflow-hidden shadow-sm">
                    <PillButton
                        onClick={onZoomIn}
                        title={t('map.controls.zoomIn')}
                    >
                        <Plus size={20} strokeWidth={1.5} />
                    </PillButton>
                    <ButtonGroupSeparator orientation="horizontal" className="bg-border/50 mx-2" />
                    <PillButton
                        onClick={onZoomOut}
                        title={t('map.controls.zoomOut')}
                    >
                        <Minus size={20} strokeWidth={1.5} />
                    </PillButton>
                </ButtonGroup>

                {/* Compass Button */}
                {showCompass && (
                    <ControlButton
                        onClick={onResetBearing}
                        title={t('map.controls.resetBearing')}
                        className="shadow-sm"
                    >
                        <Compass size={20} strokeWidth={1.5} className="transition-transform" />
                    </ControlButton>
                )}
            </div>
        </div>
    );
});

const ControlButton = ({ children, onClick, title, testId, className }: { children: React.ReactNode, onClick: (e: React.MouseEvent) => void, title: string, testId?: string, className?: string }) => (
    <Tooltip>
        <TooltipTrigger render={
            <Button
                variant="tinted"
                size="icon"
                onClick={onClick}
                aria-label={title}
                className={cn(
                    "shrink-0",
                    className
                )}
                data-testid={testId}
            >
                {children}
            </Button>
        } />
        <TooltipContent side="left" sideOffset={8}>
            <p className="font-medium text-xs">{title}</p>
        </TooltipContent>
    </Tooltip>
);

ControlButton.displayName = 'ControlButton';

const PillButton = ({ children, onClick, title, testId, className }: { children: React.ReactNode, onClick: (e: React.MouseEvent) => void, title: string, testId?: string, className?: string }) => (
    <Tooltip>
        <TooltipTrigger render={
            <Button
                variant="ghost"
                size="icon"
                onClick={onClick}
                aria-label={title}
                className={cn("relative rounded-none shrink-0 h-11 w-11", className)}
                data-testid={testId}
            >
                {children}
            </Button>
        } />
        <TooltipContent side="left" sideOffset={8}>
            <p className="font-medium text-xs">{title}</p>
        </TooltipContent>
    </Tooltip>
);

PillButton.displayName = 'PillButton';


MapControls.displayName = 'MapControls';
