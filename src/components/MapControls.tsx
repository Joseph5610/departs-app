
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LocateFixed, Settings, Plus, Minus, Compass } from 'lucide-react';
import { Alerts } from './Alerts';
import { useMap } from '../hooks/useMap';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Overlay, Stack } from '@/components/ui/layout';
import { ButtonGroup, ButtonGroupSeparator } from '@/components/ui/button-group';

/**
 * MapControls Component
 *
 * Re-architected with semantic components to remove redundant positioning classes.
 * Applied glassy theme with increased transparency for better backdrop-blur visibility.
 */
export const MapControls = React.memo(() => {
    const { t } = useTranslation();
    const { state, actions, mapRef } = useMap();

    const { mapLoaded, isGeoPending } = state;
    const { handleLocate: onLocate, setIsSettingsOpen } = actions;

    const onSettings = React.useCallback(() => {
        setIsSettingsOpen(true);
    }, [setIsSettingsOpen]);

    const onZoomIn = React.useCallback(() => {
        mapRef.current?.zoomIn();
    }, [mapRef]);

    const onZoomOut = React.useCallback(() => {
        mapRef.current?.zoomOut();
    }, [mapRef]);

    const onResetBearing = React.useCallback(() => {
        mapRef.current?.easeTo({
            bearing: 0,
            duration: 1000,
            pitch: 0
        });
    }, [mapRef]);

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
        <Overlay position="top-right" className="safe-top safe-right p-4 z-40" data-testid="map-controls">
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
                    />
                </ControlButton>

                <ControlButton
                    onClick={onSettings}
                    title={t('map.controls.settings')}
                    testId="map-settings-btn"
                >
                    <Settings size={20} className="transition-transform group-hover:rotate-45" />
                </ControlButton>

                <Alerts />

                <ButtonGroup orientation="vertical" className="mt-2 rounded-2xl overflow-hidden glassy-tinted border-white/20!">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onZoomIn}
                        className="h-11 w-11 rounded-none hover:bg-white/10 active:bg-white/20 transition-all border-none!"
                        title={t('map.controls.zoomIn')}
                        aria-label={t('map.controls.zoomIn')}
                    >
                        <Plus size={20} />
                    </Button>
                    <ButtonGroupSeparator orientation="horizontal" className="mx-2" />
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onZoomOut}
                        className="h-11 w-11 rounded-none hover:bg-white/10 active:bg-white/20 transition-all border-none!"
                        title={t('map.controls.zoomOut')}
                        aria-label={t('map.controls.zoomOut')}
                    >
                        <Minus size={20} />
                    </Button>
                </ButtonGroup>

                {showCompass && (
                    <ControlButton
                        onClick={onResetBearing}
                        title={t('map.controls.resetBearing')}
                    >
                        <Compass size={20} className="transition-transform group-hover:rotate-12" />
                    </ControlButton>
                )}
            </Stack>
        </Overlay>
    );
});

const ControlButton = ({ children, onClick, title, testId }: { children: React.ReactNode, onClick: (e: React.MouseEvent) => void, title: string, testId?: string }) => (
    <Button
        variant="tinted"
        size="icon"
        onClick={onClick}
        title={title}
        aria-label={title}
        className="h-11 w-11 border-white/20!"
        data-testid={testId}
    >
        {children}
    </Button>
);

MapControls.displayName = 'MapControls';
