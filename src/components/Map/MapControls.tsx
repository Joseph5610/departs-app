
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, LocateFixed, Settings, Plus, Minus, Compass, Star } from 'lucide-react';
import { useGlobalAlerts } from '../../hooks/data/useGlobalAlerts';
import { usePreferencesStore } from '../../state/preferencesStore';
import { useMapMetadataStore } from '../../state/mapMetadataStore';
import { useGeolocationStore } from '../../state/geolocationStore';
import { cn } from '@/lib/utils';
import { useGeolocation } from '../../hooks/features/useGeolocation';
import { Button } from '@/components/ui/button';
import { ButtonGroup, ButtonGroupSeparator } from '@/components/ui/button-group';
import { CitySwitcher } from './CitySwitcher';

interface MapControlsProps {
    onToggleFavorites?: () => void;
    isFavoritesActive?: boolean;
}

/**
 * MapControls Component
 *
 * Unified control palette using Shadcn Card and standard Buttons.
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
        <div className="fixed top-0 right-0 safe-top safe-right p-4 md:p-0 md:top-5 md:right-5 z-40 pointer-events-none" data-testid="map-controls">
            <div className="flex flex-col gap-2 items-end pointer-events-auto">
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
                     />
                </ControlButton>

                <ControlButton
                    onClick={onSettings}
                    title={t('map.controls.settings')}
                    testId="map-settings-btn"
                >
                    <Settings size={20} className="transition-transform group-hover:rotate-45" />
                </ControlButton>

                <ControlButton
                    onClick={onAlerts}
                    title={t('alerts.title')}
                    testId="map-alerts-btn"
                    className="relative"
                >
                    <AlertTriangle size={20} className={cn(incidentsCount > 0 ? "text-destructive" : "transition-transform group-hover:scale-110")} />
                    {incidentsCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center shadow-sm">
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
                     />
                </ControlButton>

                <ButtonGroup orientation="vertical" className="mt-2 glassy rounded-full! overflow-hidden">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onZoomIn}
                        className="rounded-none shrink-0"
                        title={t('map.controls.zoomIn')}
                        aria-label={t('map.controls.zoomIn')}
                    >
                        <Plus size={20} />
                    </Button>
                    <ButtonGroupSeparator orientation="horizontal" className="bg-border/50 mx-2" />
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onZoomOut}
                        className="rounded-none shrink-0"
                        title={t('map.controls.zoomOut')}
                        aria-label={t('map.controls.zoomOut')}
                    >
                        <Minus size={20} />
                    </Button>
                </ButtonGroup>

                <div className="mt-2">
                    <CitySwitcher />
                </div>

                {showCompass && (
                    <ControlButton
                        onClick={onResetBearing}
                        title={t('map.controls.resetBearing')}
                        className="mt-2"
                    >
                        <Compass size={20} className="transition-transform group-hover:rotate-12" />
                    </ControlButton>
                )}
            </div>
        </div>
    );
});

const ControlButton = ({ children, onClick, title, testId, className }: { children: React.ReactNode, onClick: (e: React.MouseEvent) => void, title: string, testId?: string, className?: string }) => (
    <Button
        variant="tinted"
        size="icon"
        onClick={onClick}
        title={title}
        aria-label={title}
        className={cn(
            "shrink-0",
            className
        )}
        data-testid={testId}
    >
        {children}
    </Button>
);

ControlButton.displayName = 'ControlButton';


MapControls.displayName = 'MapControls';
