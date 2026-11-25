import { useState, useEffect, useMemo, useCallback, memo } from 'react';
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
import { ButtonGroup, ButtonGroupSeparator } from '@/components/ui/button-group';

import { useRouteParams } from '@/hooks/useRouteParams';
import { MAP_CAMERA } from '@/config/constants';
import { Badge } from '@/components/ui/badge';
import { FloorSwitcher } from './FloorSwitcher';
import { MapControlButton } from './MapControlButton';

// The fade stays on the glass itself: on a parent it would cut the glass off from the map behind it.
const PILL = 'glassy rounded-full overflow-hidden';
const SHEET_PILL = cn(PILL, 'opacity-(--sheet-controls-opacity,1)');

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
            className={cn(isGeoPending && "text-tint-mint motion-safe:animate-pulse")}
        />
    );

    const settingsButton = (
        <MapControlButton
            inSheet={placement === 'sheet'}
            onClick={onSettings}
            title={t('map.controls.settings')}
            testId="map-settings-btn"
        >
            <Settings size={20} strokeWidth={1.5} />
            {isFiltered && (
                <span className="absolute top-1.5 right-1.5 grid size-4 place-items-center rounded-full bg-primary text-primary-foreground pointer-events-none">
                    <Filter className="size-2.5" strokeWidth={2.5} />
                </span>
            )}
        </MapControlButton>
    );

    const alertsButton = hasAlerts && (
        <>
            <ButtonGroupSeparator orientation="horizontal" />
            <MapControlButton
                onClick={onAlerts}
                title={t('alerts.title')}
                testId="map-alerts-btn"
            >
                <AlertTriangle size={20} strokeWidth={1.5} className={cn(incidentsCount > 0 && "text-destructive")} />
                {incidentsCount > 0 && (
                    <Badge variant="alert" className="pointer-events-none absolute top-1 right-1 shadow-sm">{incidentsCount}</Badge>
                )}
            </MapControlButton>
        </>
    );

    const compassButton = showCompass && (
        <MapControlButton
            inSheet={placement === 'sheet'}
            onClick={onResetBearing}
            title={t('map.controls.resetBearing')}
        >
            <Compass size={20} strokeWidth={1.5} className="transition-transform" />
        </MapControlButton>
    );

    if (placement === 'sheet') {
        return (
            <div
                className={cn(
                    "absolute bottom-full right-3 mb-3 flex flex-col gap-2 items-end",
                    hidden && "pointer-events-none"
                )}
                data-testid="map-controls"
            >
                <FloorSwitcher className={SHEET_PILL} inSheet />
                {compassButton && <ButtonGroup orientation="vertical" className={SHEET_PILL}>{compassButton}</ButtonGroup>}
                <ButtonGroup orientation="vertical" className={SHEET_PILL}>
                    {settingsButton}
                    <ButtonGroupSeparator orientation="horizontal" />
                    <MapControlButton
                        inSheet
                        onClick={(e) => onLocate(e)}
                        title={t('map.controls.myLocation')}
                        testId="map-locate-btn"
                    >
                        {locateIcon}
                    </MapControlButton>
                </ButtonGroup>
            </div>
        );
    }

    return (
        <div className="fixed top-0 md:top-(--chrome-top) right-0 safe-top safe-right p-4 md:p-0 md:right-5 z-40 pointer-events-none" data-testid="map-controls">
            <div className="flex flex-col gap-2 items-end pointer-events-auto">
                <ButtonGroup orientation="vertical" className={PILL}>
                    <MapControlButton
                        onClick={(e) => onLocate(e)}
                        title={t('map.controls.myLocation')}
                        testId="map-locate-btn"
                    >
                        {locateIcon}
                    </MapControlButton>
                </ButtonGroup>

                <ButtonGroup orientation="vertical" className={PILL}>
                    {settingsButton}
                    {alertsButton}
                    <ButtonGroupSeparator orientation="horizontal" />
                    <MapControlButton
                        onClick={onToggleFavorites}
                        title={t('favorites.title')}
                        testId="map-favorites-btn"
                    >
                        <Star
                            size={20}
                            strokeWidth={1.5}
                            className={cn(
                                isFavoritesRoute && "fill-primary text-tint-mint"
                            )}
                         />
                    </MapControlButton>
                    <ButtonGroupSeparator orientation="horizontal" />
                    <MapControlButton
                        onClick={onStats}
                        title={t('stats.title')}
                        testId="map-stats-btn"
                    >
                        <BarChart3
                            size={20}
                            strokeWidth={1.5}
                            className={cn(
                                isStatsRoute && "text-tint-mint"
                            )}
                        />
                    </MapControlButton>
                </ButtonGroup>

                <ButtonGroup orientation="vertical" className={PILL}>
                    <MapControlButton
                        onClick={onZoomIn}
                        title={t('map.controls.zoomIn')}
                    >
                        <Plus size={20} strokeWidth={1.5} />
                    </MapControlButton>
                    <ButtonGroupSeparator orientation="horizontal" />
                    <MapControlButton
                        onClick={onZoomOut}
                        title={t('map.controls.zoomOut')}
                    >
                        <Minus size={20} strokeWidth={1.5} />
                    </MapControlButton>
                </ButtonGroup>

                {compassButton && <ButtonGroup orientation="vertical" className={PILL}>{compassButton}</ButtonGroup>}

                <FloorSwitcher className={PILL} />
            </div>
        </div>
    );
});

MapControls.displayName = 'MapControls';
