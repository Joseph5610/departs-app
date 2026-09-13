import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, LocateFixed, Plus, Minus, Compass, Star, AlertTriangle, BarChart3 } from 'lucide-react';
import { navigate } from 'wouter/use-browser-location';
import { paths } from '../../lib/routes';
import { useGlobalAlerts } from '../../hooks/data/useGlobalAlerts';
import { usePreferencesStore } from '../../state/preferencesStore';
import { useUiStore } from '../../state/uiStore';
import { useMapMetadataStore } from '../../state/mapMetadataStore';
import { useGeolocationStore } from '../../state/geolocationStore';
import { cn } from '@/lib/utils';
import { useLocate } from '../../hooks/features/useGeolocation';
import { Button } from '@/components/ui/button';
import { ButtonGroup, ButtonGroupSeparator } from '@/components/ui/button-group';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

import { useRouteParams } from '../../hooks/useRouteParams';
import { MAP_CAMERA } from '../../config/constants';

export const MapControls = React.memo(() => {
    const { t } = useTranslation();

    // Preferences Actions
    const { setIsSettingsOpen, setIsAlertsOpen } = useUiStore(s => s.actions);
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const isFiltered = usePreferencesStore(
        s => s.routeTypeFilter.length > 0 || s.delayFilter.length > 0 || s.stopTypeFilter.length > 0 || s.requireAirConditioned
    );

    // Routes
    const { isStatsRoute, isFavoritesRoute } = useRouteParams();

    const { rss, hasAlerts } = useGlobalAlerts();
    const incidentsCount = React.useMemo(() => rss.data?.alerts?.filter(a => a.type === 'incident').length || 0, [rss.data]);

    // Geolocation Store
    const isGeoPending = useGeolocationStore(s => s.isGeoPending);
    const onLocate = useLocate();

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
        navigate(isStatsRoute ? paths.city(selectedCity) : paths.stats(selectedCity));
    }, [isStatsRoute, selectedCity]);

    const onToggleFavorites = React.useCallback(() => {
        navigate(isFavoritesRoute ? paths.city(selectedCity) : paths.favorites(selectedCity));
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
            duration: MAP_CAMERA.EASE_MS,
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
                    <ControlButton
                        inPill
                        onClick={onSettings}
                        title={t('map.controls.settings')}
                        testId="map-settings-btn"
                    >
                        <Settings size={20} strokeWidth={1.5} className={cn("transition-transform hover:rotate-45", isFiltered && "text-purple-400")} />
                        {isFiltered && (
                            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-purple-500 rounded-full shadow-[0_0_8px_var(--color-purple-500)] pointer-events-none" />
                        )}
                    </ControlButton>
                    {hasAlerts && (
                        <>
                            <ButtonGroupSeparator orientation="horizontal" className="bg-border/50 mx-2" />
                            <ControlButton
                                inPill
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
                            </ControlButton>
                        </>
                    )}
                    <ButtonGroupSeparator orientation="horizontal" className="bg-border/50 mx-2" />
                    <ControlButton
                        inPill
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
                    </ControlButton>
                    <ButtonGroupSeparator orientation="horizontal" className="bg-border/50 mx-2" />
                    <ControlButton
                        inPill
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
                    </ControlButton>
                </ButtonGroup>

                {/* Zoom Pill */}
                <ButtonGroup orientation="vertical" className="glassy rounded-full overflow-hidden shadow-sm">
                    <ControlButton
                        inPill
                        onClick={onZoomIn}
                        title={t('map.controls.zoomIn')}
                    >
                        <Plus size={20} strokeWidth={1.5} />
                    </ControlButton>
                    <ButtonGroupSeparator orientation="horizontal" className="bg-border/50 mx-2" />
                    <ControlButton
                        inPill
                        onClick={onZoomOut}
                        title={t('map.controls.zoomOut')}
                    >
                        <Minus size={20} strokeWidth={1.5} />
                    </ControlButton>
                </ButtonGroup>

                {/* Compass Button */}
                {showCompass && (
                    <ControlButton
                        onClick={onResetBearing}
                        title={t('map.controls.resetBearing')}
                    >
                        <Compass size={20} strokeWidth={1.5} className="transition-transform" />
                    </ControlButton>
                )}
            </div>
        </div>
    );
});

interface ControlButtonProps {
    children: React.ReactNode;
    onClick: (e: React.MouseEvent) => void;
    title: string;
    testId?: string;
    /** Borderless segment inside a ButtonGroup pill instead of a standalone round button. */
    inPill?: boolean;
}

const ControlButton = ({ children, onClick, title, testId, inPill = false }: ControlButtonProps) => (
    <Tooltip>
        <TooltipTrigger render={
            <Button
                variant={inPill ? 'ghost' : 'tinted'}
                size="icon"
                onClick={onClick}
                aria-label={title}
                className={inPill ? "relative rounded-none shrink-0 h-11 w-11" : "shrink-0 shadow-sm"}
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


MapControls.displayName = 'MapControls';
