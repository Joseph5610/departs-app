
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LocateFixed, Settings, Plus, Minus, Compass } from 'lucide-react';
import { Alerts } from './Alerts';
import { useMap } from '../hooks/useMap';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Overlay, Stack, Surface, Box } from '@/components/ui/layout';

/**
 * MapControls Component
 *
 * Re-architected with semantic components to remove redundant positioning classes.
 * Applied glassy theme to zoom controls.
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
        <Overlay position="top-right" className="safe-top safe-right">
            <Stack className="gap-2">
                <ControlButton
                    onClick={(e) => onLocate(e)}
                    title={t('map.controls.myLocation')}
                >
                    <LocateFixed
                        size={20}
                        className={cn(
                            "transition-all",
                            isGeoPending ? "animate-spin text-primary" : "group-hover:scale-110"
                        )}
                    />
                </ControlButton>

                <ControlButton
                    onClick={onSettings}
                    title={t('map.controls.settings')}
                >
                    <Settings size={20} className="group-hover:rotate-45 transition-transform" />
                </ControlButton>

                <Alerts />

                <Surface className="flex flex-col mt-2 overflow-hidden rounded-2xl bg-background/95 backdrop-blur-md shadow-2xl border-border">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onZoomIn}
                        className="h-11 w-11 rounded-none hover:bg-muted"
                        title={t('map.controls.zoomIn')}
                    >
                        <Plus size={20} />
                    </Button>
                    <Box className="mx-2 h-[1px] bg-border" />
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onZoomOut}
                        className="h-11 w-11 rounded-none hover:bg-muted"
                        title={t('map.controls.zoomOut')}
                    >
                        <Minus size={20} />
                    </Button>
                </Surface>

                {showCompass && (
                    <ControlButton
                        onClick={onResetBearing}
                        title={t('map.controls.resetBearing')}
                    >
                        <Compass size={20} className="group-hover:rotate-12 transition-transform" />
                    </ControlButton>
                )}
            </Stack>
        </Overlay>
    );
});

const ControlButton = ({ children, onClick, title }: { children: React.ReactNode, onClick: (e: React.MouseEvent) => void, title: string }) => (
    <Button
        variant="outline"
        size="icon"
        onClick={onClick}
        title={title}
        aria-label={title}
        className="h-11 w-11 rounded-2xl bg-background/95 backdrop-blur-md shadow-2xl border-border"
    >
        {children}
    </Button>
);

MapControls.displayName = 'MapControls';
