
import { useState, useCallback, useEffect } from 'react';
import { LS_KEYS } from '../config/constants';
import type { TrackedVehicle } from '../types/transit';

/**
 * Hook to manage the core UI and selection state for the map application.
 * Handles selection of stops/vehicles and global UI toggles like settings and filters.
 * Persists user preferences to local storage.
 *
 * @returns An object containing all map-related state and their setters.
 */
export const useMapState = () => {
    const [selectedStop, setSelectedStop] = useState<{ id: string; name: string } | null>(null);
    const [selectedVehicle, setSelectedVehicle] = useState<TrackedVehicle | null>(null);
    const [isFollowing, setIsFollowing] = useState(false);

    const [showVehicles, setShowVehicles] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(LS_KEYS.SHOW_VEHICLES);
            return saved !== null ? saved === 'true' : true;
        }
        return true;
    });

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

    const [departureSort, setDepartureSort] = useState<'line' | 'departure'>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(LS_KEYS.DEPARTURE_SORT);
            return (saved === 'line' || saved === 'departure') ? saved : 'line';
        }
        return 'line';
    });

    const [routeFilter, setRouteFilter] = useState<string[] | null>(null);

    // Persist settings
    useEffect(() => {
        localStorage.setItem(LS_KEYS.SHOW_VEHICLES, String(showVehicles));
    }, [showVehicles]);

    useEffect(() => {
        localStorage.setItem(LS_KEYS.DEPARTURE_SORT, departureSort);
    }, [departureSort]);

    const toggleGroup = useCallback((groupId: string) => {
        setExpandedGroups(prev => prev.includes(groupId) ? prev.filter(g => g !== groupId) : [...prev, groupId]);
    }, []);

    return {
        selectedStop, setSelectedStop,
        selectedVehicle, setSelectedVehicle,
        isFollowing, setIsFollowing,
        showVehicles, setShowVehicles,
        isSettingsOpen, setIsSettingsOpen,
        expandedGroups, setExpandedGroups,
        departureSort, setDepartureSort,
        routeFilter, setRouteFilter,
        toggleGroup
    };
};
