import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, LocateFixed, Plus, Minus, Compass, Star, AlertTriangle, BarChart3, Filter } from 'lucide-react';
import { closeDetail, navigate } from '@/lib/history';
import { paths } from '@/lib/routes';
import { useAlerts } from '@/hooks/data/useAlerts';
import { countIncidents } from '@/domain/alerts';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useUiStore } from '@/state/uiStore';
import { useMapMetadataStore } from '@/state/mapMetadataStore';
import { useGeolocationStore } from '@/state/geolocationStore';
import { cn } from '@/lib/cn';
import { useLocate } from '@/hooks/features/useGeolocation';
import { Button } from '@/components/ui/button';
import { ButtonGroup, ButtonGroupSeparator } from '@/components/ui/button-group';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

import { useRouteParams } from '@/hooks/useRouteParams';
import { MAP_CAMERA } from '@/config/constants';

const SHEET_PILL = 'glassy rounded-full overflow-hidden shadow-lg';

interface MapControlsProps {
    /** `corner` floats top-right of the map; `sheet` rides above the mobile sheet's top edge with only settings and locate. */
    placement?: 'corner' | 'sheet';
    /** Fades the sheet controls out, for a sheet pulled up to full height. */
    hidden?: boolean;
}

export const MapControls = memo(({ placement = 'corner', hidden = false }: MapControlsProps) => {
    const { t } = useTranslation();

    const { setIsSettingsOpen, setIsAlertsOpen } = useUiStore(s => s.actions);
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const isFiltered = usePreferencesStore(
        s => s.routeTypeFilter.length > 0 || s.delayFilter.length > 0 || s.stopTypeFilter.length > 0
    );

    const { isStatsRoute, isFavoritesRoute } = useRouteParams();

    const { alerts, hasAlerts } = useAlerts();
    const incidentsCount = useMemo(() => countIncidents(alerts), [alerts]);

    const isGeoPending = useGeolocationStore(s => s.focusRequest === 'locate');
    const onLocate = useLocate();

    const mapRef = useMapMetadataStore(s => s.mapRef);
    const mapLoaded = useMapMetadataStore(s => s.mapLoaded);
    const { easeTo, zoomIn, zoomOut } = useMapMetadataStore(s => s.actions);

    const onSettings = useCallback(() => {
        setIsSettingsOpen(true);
    }, [setIsSettingsOpen]);

    const onAlerts = useCallback(() => {
        setIsAlertsOpen(true);
    }, [setIsAlertsOpen]);

    const onStats = useCallback(() => {
        if (isStatsRoute) closeDetail(paths.city(selectedCity));
        else navigate(paths.stats(selectedCity));
    }, [isStatsRoute, selectedCity]);

    const onToggleFavorites = useCallback(() => {
        if (isFavoritesRoute) closeDetail(paths.city(selectedCity));
        else navigate(paths.favorites(selectedCity));
    }, [isFavoritesRoute, selectedCity]);

    const onZoomIn = useCallback(() => {
        zoomIn();
    }, [zoomIn]);

    const onZoomOut = useCallback(() => {
        zoomOut();
    }, [zoomOut]);

    const onResetBearing = useCallback(() => {
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

    const locateIcon = (
        <LocateFixed
            size={20}
            strokeWidth={1.5}
            className={cn(
                "transition-all",
                isGeoPending ? "animate-spin text-primary" : "transition-transform"
            )}
         />
    );

    const settingsButton = (
        <ControlButton
            inPill
            onClick={onSettings}
            title={t('map.controls.settings')}
            testId="map-settings-btn"
        >
            <Settings size={20} strokeWidth={1.5} className={cn("transition-transform hover:rotate-45", isFiltered && "text-purple-400")} />
            {isFiltered && (
                <span className="absolute top-1.5 right-1.5 grid size-4 place-items-center rounded-full bg-purple-500 text-white pointer-events-none">
                    <Filter className="size-2.5" strokeWidth={2.5} />
                </span>
            )}
        </ControlButton>
    );

    const alertsButton = hasAlerts && (
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
                    <span className="absolute top-1 right-1 bg-destructive text-destructive-foreground text-micro font-bold px-1 py-0 rounded-full min-w-4 text-center shadow-sm pointer-events-none">
                        {incidentsCount}
                    </span>
                )}
            </ControlButton>
        </>
    );

    const compassButton = showCompass && (
        <ControlButton
            inPill={placement === 'sheet'}
            onClick={onResetBearing}
            title={t('map.controls.resetBearing')}
        >
            <Compass size={20} strokeWidth={1.5} className="transition-transform" />
        </ControlButton>
    );

    if (placement === 'sheet') {
        return (
            <div
                className={cn(
                    "absolute bottom-full right-3 mb-3 flex flex-col gap-2 items-end transition-opacity duration-200",
                    hidden ? "opacity-0 pointer-events-none" : "opacity-100"
                )}
                data-testid="map-controls"
            >
                {compassButton && <ButtonGroup orientation="vertical" className={SHEET_PILL}>{compassButton}</ButtonGroup>}
                <ButtonGroup orientation="vertical" className={SHEET_PILL}>
                    {settingsButton}
                    <ButtonGroupSeparator orientation="horizontal" className="bg-border/50 mx-2" />
                    <ControlButton
                        inPill
                        onClick={(e) => onLocate(e)}
                        title={t('map.controls.myLocation')}
                        testId="map-locate-btn"
                    >
                        {locateIcon}
                    </ControlButton>
                </ButtonGroup>
            </div>
        );
    }

    return (
        <div className="fixed top-0 md:top-5 right-0 safe-top safe-right p-4 md:p-0 md:right-5 z-40 pointer-events-none" data-testid="map-controls">
            <div className="flex flex-col gap-2 items-end pointer-events-auto">
                <ControlButton
                    onClick={(e) => onLocate(e)}
                    title={t('map.controls.myLocation')}
                    testId="map-locate-btn"
                >
                    {locateIcon}
                </ControlButton>

                <ButtonGroup orientation="vertical" className="glassy rounded-full overflow-hidden shadow-sm">
                    {settingsButton}
                    {alertsButton}
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

                {compassButton}
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

MapControls.displayName = 'MapControls';
