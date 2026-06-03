
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, LocateFixed, Settings, Plus, Minus, Compass, Star } from 'lucide-react';
import { useGlobalAlerts } from '../../hooks/data/useGlobalAlerts';
import { usePreferencesStore } from '../../state/preferencesStore';
import { useMapMetadataStore } from '../../state/mapMetadataStore';
import { useGeolocationStore } from '../../state/geolocationStore';
import { useGeolocation } from '../../hooks/features/useGeolocation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Overlay, Stack } from '@/components/ui/layout';
import { ButtonGroup, ButtonGroupSeparator } from '@/components/ui/button-group';
import { CitySwitcher } from './CitySwitcher';

interface MapControlsProps {
    onToggleFavorites?: () => void;
    isFavoritesActive?: boolean;
}

/**
 * MapControls Component
 *
 * Re-architected with semantic components to remove redundant positioning classes.
 * Applied glassy theme with increased transparency for better backdrop-blur visibility.
 */
export const MapControls = React.memo(({ onToggleFavorites, isFavoritesActive }: MapControlsProps) => {
    const { t } = useTranslation();

    // Preferences Actions
    const { setIsSettingsOpen, setIsAlertsOpen } = usePreferencesStore(s => s.actions);

    // Geolocation Store
    const isGeoPending = useGeolocationStore(s => s.isGeoPending);
    const { handleLocate: onLocate } = useGeolocation();

    // Metadata Store
    const mapRef = useMapMetadataStore(s => s.mapRef);
    const mapLoaded = useMapMetadataStore(s => s.mapLoaded);
    const { easeTo, zoomIn, zoomOut } = useMapMetadataStore(s => s.actions);

    const { rss } = useGlobalAlerts();
    const incidentsCount = useMemo(() => rss.data?.alerts?.filter(a => a.type === 'incident').length || 0, [rss.data]);

    const onSettings = React.useCallback(() => {
        setIsSettingsOpen(true);
    }, [setIsSettingsOpen]);

    const onAlerts = React.useCallback(() => {
        setIsAlertsOpen(true);
    }, [setIsAlertsOpen]);

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
        <Overlay position="top-right" className="safe-top safe-right p-4 md:p-0 md:top-5 md:right-5 z-40" data-testid="map-controls">
            <Stack gap={2}>
                <ControlButton
                    onClick={(e) => onLocate(e)}
                    title={t('map.controls.myLocation')}
                    testId="map-locate-btn"
                >
                    <LocateFixed
                        size={20}
                        className={cn(
                            "transition-all",
                            isGeoPending ? "animate-spin text-primary" : "transition-transform group-hover:scale-110"
                        )}
                     strokeWidth={1.5} />
                </ControlButton>

                <ControlButton
                    onClick={onSettings}
                    title={t('map.controls.settings')}
                    testId="map-settings-btn"
                >
                    <Settings size={20} className="transition-transform group-hover:rotate-45"  strokeWidth={1.5} />
                </ControlButton>

                <ControlButton
                    onClick={onAlerts}
                    title={t('alerts.title')}
                    testId="map-alerts-btn"
                    className="relative"
                >
                    <AlertTriangle size={20} className={cn(incidentsCount > 0 ? "text-destructive" : "transition-transform group-hover:scale-110")} />
                    {incidentsCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-[#151515] min-w-[20px] text-center">
                            {incidentsCount}
                        </span>
                    )}
                </ControlButton>

                <ControlButton
                    onClick={onToggleFavorites || (() => {})}
                    title={t('favorites.title')}
                    testId="map-favorites-btn"
                    className="relative"
                >
                    <Star
                        size={20}
                        className={cn(
                            isFavoritesActive ? "fill-primary text-primary" : "transition-transform group-hover:scale-110"
                        )}
                     strokeWidth={1.5} />
                </ControlButton>

                <ButtonGroup orientation="vertical" className="mt-2 rounded-2xl overflow-hidden glassy-tinted">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onZoomIn}
                        className="h-11 w-11 rounded-none border-none!"
                        title={t('map.controls.zoomIn')}
                        aria-label={t('map.controls.zoomIn')}
                    >
                        <Plus size={20}  strokeWidth={1.5} />
                    </Button>
                    <ButtonGroupSeparator orientation="horizontal" className="mx-2 bg-white/10" />
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onZoomOut}
                        className="h-11 w-11 rounded-none border-none!"
                        title={t('map.controls.zoomOut')}
                        aria-label={t('map.controls.zoomOut')}
                    >
                        <Minus size={20}  strokeWidth={1.5} />
                    </Button>
                </ButtonGroup>

                <CitySwitcher />

                {showCompass && (
                    <ControlButton
                        onClick={onResetBearing}
                        title={t('map.controls.resetBearing')}
                        className=""
                    >
                        <Compass size={20} className="transition-transform group-hover:rotate-12"  strokeWidth={1.5} />
                    </ControlButton>
                )}
            </Stack>
        </Overlay>
    );
});

const ControlButton = ({ children, onClick, title, testId, className }: { children: React.ReactNode, onClick: (e: React.MouseEvent) => void, title: string, testId?: string, className?: string }) => (
    <Button
        variant="tinted"
        size="icon"
        onClick={onClick}
        title={title}
        aria-label={title}
        className={cn("h-11 w-11", className)}
        data-testid={testId}
    >
        {children}
    </Button>
);

ControlButton.displayName = 'ControlButton';


MapControls.displayName = 'MapControls';
