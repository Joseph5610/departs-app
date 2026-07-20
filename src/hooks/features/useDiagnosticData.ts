import type { DiagnosticData } from '../../types/feedback';
import { useViewportStore } from '../../state/viewportStore';
import { useSelectionStore } from '../../state/selectionStore';
import { useGeolocationStore } from '../../state/geolocationStore';
import { usePreferencesStore } from '../../state/preferencesStore';
import { version } from '../../../package.json';

const START_TIME = Date.now();

export function getDiagnosticSnapshot(): DiagnosticData {
    const viewport = useViewportStore.getState();
    const selection = useSelectionStore.getState();
    const geolocation = useGeolocationStore.getState();
    const preferences = usePreferencesStore.getState();

    const connectionType = 
        typeof navigator !== 'undefined' && 'connection' in navigator 
            // @ts-expect-error - navigator.connection is not standard
            ? navigator.connection?.effectiveType 
            : undefined;
            
    const isPwa = window.matchMedia('(display-mode: standalone)').matches;

    return {
        url: window.location.href,
        userAgent: navigator.userAgent,
        appVersion: version,
        windowSize: {
            width: window.innerWidth,
            height: window.innerHeight
        },
        connectionType,
        sessionDurationSec: Math.floor((Date.now() - START_TIME) / 1000),
        
        devicePixelRatio: window.devicePixelRatio,
        hardwareConcurrency: navigator.hardwareConcurrency,
        // @ts-expect-error - navigator.deviceMemory is not standard
        deviceMemory: navigator.deviceMemory,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,

        // mapCenter/Zoom not easily available from ViewportStore since it uses bounds
        activeLayers: viewport.routeFilter || undefined,
        
        selectedVehicleId: selection.selectedLine || undefined,
        selectedStopId: undefined,
        isFollowing: selection.isFollowing,

        selectedCity: preferences.selectedCity,
        showVehicles: preferences.showVehicles,
        showStops: preferences.showStops,
        mapBaseStyle: preferences.mapBaseStyle,
        
        theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
        locale: navigator.language,
        isPwa: isPwa,
        gpsEnabled: geolocation.userLocation !== null,
    };
}
