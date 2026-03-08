
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LocateFixed, Settings, Plus, Minus, Compass } from 'lucide-react';
import { Alerts } from './Alerts';
import { useMap } from '../hooks/useMap';
import { cn } from '@/lib/utils';


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
            // Show compass if bearing or pitch is more than 0.5 degrees
            setShowCompass(Math.abs(bearing) > 0.5 || Math.abs(pitch) > 0.5);
        };

        map.on('rotate', updateCompass);
        map.on('pitch', updateCompass);

        // Initial check
        updateCompass();

        return () => {
            map.off('rotate', updateCompass);
            map.off('pitch', updateCompass);
        };
    }, [mapRef, mapLoaded]);

    return (
        <div className="absolute z-10 flex flex-col gap-2 safe-top safe-right">
            <button
                onClick={(e) => onLocate(e)}
                className="p-3 bg-background/95 backdrop-blur-md hover:bg-background/80 active:bg-accent active:scale-95 text-foreground rounded-2xl border border-border shadow-2xl transition-all pointer-events-auto group"
                title={t('map.controls.myLocation')}
                aria-label={t('map.controls.myLocation')}
            >
                <LocateFixed
                    size={20}
                    className={cn(
                        "transition-all",
                        isGeoPending ? "animate-spin text-primary" : "group-hover:scale-110"
                    )}
                />
            </button>
            <button
                onClick={onSettings}
                className="p-3 bg-background/95 backdrop-blur-md hover:bg-background/80 active:bg-accent active:scale-95 text-foreground rounded-2xl border border-border shadow-2xl transition-all pointer-events-auto group"
                title={t('map.controls.settings')}
                aria-label={t('map.controls.settings')}
            >
                <Settings size={20} className="group-hover:rotate-45 transition-transform" />
            </button>
            <Alerts />

            <div className="flex flex-col bg-background/95 backdrop-blur-md rounded-2xl border border-border shadow-2xl mt-2 overflow-hidden">
                <button
                    onClick={onZoomIn}
                    className="p-3 text-foreground hover:bg-muted active:bg-accent active:scale-95 transition-all pointer-events-auto group"
                    title={t('map.controls.zoomIn')}
                    aria-label={t('map.controls.zoomIn')}
                >
                    <Plus size={20} className="group-hover:scale-110 transition-transform" />
                </button>
                <div className="mx-2 h-[1px] bg-border" />
                <button
                    onClick={onZoomOut}
                    className="p-3 text-foreground hover:bg-muted active:bg-accent active:scale-95 transition-all pointer-events-auto group"
                    title={t('map.controls.zoomOut')}
                    aria-label={t('map.controls.zoomOut')}
                >
                    <Minus size={20} className="group-hover:scale-110 transition-transform" />
                </button>
            </div>
            {showCompass && (
                <button
                    onClick={onResetBearing}
                    className="p-3 bg-background/95 backdrop-blur-md hover:bg-background/80 active:bg-accent active:scale-95 text-foreground rounded-2xl border border-border shadow-2xl transition-all pointer-events-auto group"
                    title={t('map.controls.resetBearing')}
                    aria-label={t('map.controls.resetBearing')}
                >
                    <Compass size={20} className="group-hover:rotate-12 transition-transform" />
                </button>
            )}
        </div>
    );
});

MapControls.displayName = 'MapControls';
