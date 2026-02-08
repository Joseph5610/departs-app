
import React from 'react';
import { useTranslation } from 'react-i18next';
import { LocateFixed, Settings, Plus, Minus } from 'lucide-react';

interface MapControlsProps {
    onLocate: (e: React.MouseEvent | React.TouchEvent) => void;
    onSettings: () => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
}

export const MapControls = React.memo<MapControlsProps>(({
    onLocate,
    onSettings,
    onZoomIn,
    onZoomOut
}) => {
    const { t } = useTranslation();

    return (
        <div
            className="absolute top-4 right-4 z-10 flex flex-col gap-2"
            style={{
                top: 'calc(1rem + env(safe-area-inset-top, 0px))',
                right: 'calc(1rem + env(safe-area-inset-right, 0px))'
            }}
        >
            <button
                onClick={(e) => onLocate(e)}
                className="p-3 bg-black/90 backdrop-blur-md hover:bg-black/80 text-white rounded-2xl border border-white/10 shadow-2xl transition-all pointer-events-auto group"
                title={t('map.controls.myLocation')}
            >
                <LocateFixed size={20} className="group-hover:scale-110 transition-transform" />
            </button>
            <button
                onClick={onSettings}
                className="p-3 bg-black/90 backdrop-blur-md hover:bg-black/80 text-white rounded-2xl border border-white/10 shadow-2xl transition-all pointer-events-auto group"
                title={t('map.controls.settings')}
            >
                <Settings size={20} className="group-hover:rotate-45 transition-transform" />
            </button>

            <div className="flex flex-col bg-black/90 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl mt-2 overflow-hidden">
                <button
                    onClick={onZoomIn}
                    className="p-3 text-white hover:bg-white/5 transition-colors pointer-events-auto group"
                    title={t('map.controls.zoomIn')}
                >
                    <Plus size={20} className="group-hover:scale-110 transition-transform" />
                </button>
                <div className="mx-2 h-[1px] bg-white/10" />
                <button
                    onClick={onZoomOut}
                    className="p-3 text-white hover:bg-white/5 transition-colors pointer-events-auto group"
                    title={t('map.controls.zoomOut')}
                >
                    <Minus size={20} className="group-hover:scale-110 transition-transform" />
                </button>
            </div>
        </div>
    );
});

MapControls.displayName = 'MapControls';
