
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Settings } from 'lucide-react';
import { Alerts } from './Alerts';
import { useMap } from '../hooks/useMap';
import { MapControls as MapcnControls, ControlGroup, ControlButton } from "@/components/ui/map";

export const MapControls = React.memo(() => {
    const { t } = useTranslation();
    const { actions } = useMap();
    const { handleLocate, setIsSettingsOpen } = actions;

    return (
        <MapcnControls
            position="top-right"
            className="safe-top safe-right"
            showZoom={true}
            showCompass={true}
            showLocate={true}
            onLocate={(coords) => {
                // The library already handles flyTo, but we can sync state if needed
                console.log('Located at:', coords);
                // Trigger manual location logic if needed (e.g. updating timestamp)
                handleLocate(new MouseEvent('click') as any);
            }}
        >
            <ControlGroup>
                <ControlButton
                    onClick={() => setIsSettingsOpen(true)}
                    label={t('map.controls.settings')}
                >
                    <Settings size={16} className="hover:rotate-45 transition-transform" />
                </ControlButton>
            </ControlGroup>
            <Alerts />
        </MapcnControls>
    );
});

MapControls.displayName = 'MapControls';
