
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LocateFixed, Settings, Plus, Minus, Compass } from 'lucide-react';
import { Alerts } from './Alerts';
import { useMap } from '../hooks/useMap';
import { MapControls as MapControlsBase, ControlGroup, ControlButton } from '@/components/ui/map';
import { cn } from "@/lib/utils";

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
        const map = mapRef.current;
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
        <MapControlsBase className="safe-top safe-right m-0 gap-2 flex flex-col items-end">
            <ControlGroup className="bg-black/90 backdrop-blur-md border-white/10 shadow-2xl rounded-2xl overflow-hidden">
                <ControlButton
                    onClick={() => onLocate(null as any)}
                    label={t('map.controls.myLocation')}
                    className="h-11 w-11 hover:bg-white/5"
                >
                    <LocateFixed
                        size={20}
                        className={cn("transition-all", isGeoPending ? 'animate-spin text-blue-400' : 'hover:scale-110')}
                    />
                </ControlButton>
            </ControlGroup>

            <ControlGroup className="bg-black/90 backdrop-blur-md border-white/10 shadow-2xl rounded-2xl overflow-hidden">
                <ControlButton
                    onClick={onSettings}
                    label={t('map.controls.settings')}
                    className="h-11 w-11 hover:bg-white/5"
                >
                    <Settings size={20} className="hover:rotate-45 transition-transform" />
                </ControlButton>
            </ControlGroup>

            <Alerts />

            <ControlGroup className="bg-black/90 backdrop-blur-md border-white/10 shadow-2xl rounded-2xl overflow-hidden">
                <ControlButton
                    onClick={onZoomIn}
                    label={t('map.controls.zoomIn')}
                    className="h-11 w-11 hover:bg-white/5"
                >
                    <Plus size={20} className="hover:scale-110 transition-transform" />
                </ControlButton>
                <ControlButton
                    onClick={onZoomOut}
                    label={t('map.controls.zoomOut')}
                    className="h-11 w-11 hover:bg-white/5"
                >
                    <Minus size={20} className="hover:scale-110 transition-transform" />
                </ControlButton>
            </ControlGroup>

            {showCompass && (
                <ControlGroup className="bg-black/90 backdrop-blur-md border-white/10 shadow-2xl rounded-2xl overflow-hidden">
                    <ControlButton
                        onClick={onResetBearing}
                        label={t('map.controls.resetBearing')}
                        className="h-11 w-11 hover:bg-white/5"
                    >
                        <Compass size={20} className="hover:rotate-12 transition-transform" />
                    </ControlButton>
                </ControlGroup>
            )}
        </MapControlsBase>
    );
});

MapControls.displayName = 'MapControls';
