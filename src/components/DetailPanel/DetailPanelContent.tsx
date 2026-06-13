import { memo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { VehicleDetail } from './VehicleDetail/VehicleDetail';
import { useSelectionStore } from '../../state/selectionStore';
import { useVehicleDetail } from '../../hooks/data/useVehicleDetail';
import { useRouteParams } from '../../hooks/useRouteParams';
import { useSelectedStop } from '../../hooks/derived/useSelectedStop';
import { useSelectedVehicle } from '../../hooks/derived/useSelectedVehicle';
import { DepartureBoard } from './DepartureBoard/DepartureBoard';
import { navigate } from 'wouter/use-browser-location';
import type { AppError } from '@/types/error';
import { usePreferencesStore } from '../../state/preferencesStore';


/**
 * DetailPanelContent
 *
 * Orchestrator for the content area of the DetailPanel.
 * Switches between VehicleDetail and DepartureBoard based on selection.
 */
export const DetailPanelContent: React.FC = memo(() => {
    // Stores
    const isFollowing = useSelectionStore(s => s.isFollowing);
    const setIsFollowing = useSelectionStore(s => s.actions.setIsFollowing);
    const clearLineFilter = useSelectionStore(s => s.actions.clearLineFilter);
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const { tripId, stopId } = useRouteParams();

    // Derived State
    const selectedStop = useSelectedStop();
    const selectedVehicle = useSelectedVehicle();

    // Data Hooks
    const { 
        data: vehicleDetail, 
        isFetching: loadingDetail,
        isError: isVehicleError,
        error: vehicleError,
        refetch: refetchVehicle
    } = useVehicleDetail();

    const showDepartureBoard = selectedStop && !selectedVehicle;
    const { t } = useTranslation();

    // Auto-close panel and show error toast if vehicle API fails
    useEffect(() => {
        if (selectedVehicle && isVehicleError && !loadingDetail && !vehicleDetail) {
            toast.error(t('toasts.vehicleNotFound'));
            navigate(`/${selectedCity}`);
        }
    }, [selectedVehicle, isVehicleError, loadingDetail, vehicleDetail, t, selectedCity]);

    // Auto-enable tracking when opening a trip
    useEffect(() => {
        if (tripId) {
            setIsFollowing(true);
        } else {
            setIsFollowing(false);
        }
    }, [tripId, setIsFollowing]);

    // Reset line filter when changing stops
    useEffect(() => {
        clearLineFilter();
    }, [stopId, clearLineFilter]);

    return (
        <div className="flex flex-col gap-0 pt-0">
            <VehicleDetail
                selectedVehicle={selectedVehicle}
                vehicleDetail={vehicleDetail || null}
                loadingDetail={loadingDetail}
                isError={isVehicleError}
                error={vehicleError as AppError}
                onRetry={refetchVehicle}
                isFollowing={isFollowing}
                onToggleFollow={() => setIsFollowing(!isFollowing)}
            />

            {showDepartureBoard && (
                <DepartureBoard 
                    selectedStop={selectedStop}
                    onDepartureClick={async (tripId, vehicleId) => {
                        if (vehicleId && vehicleId !== tripId) {
                            navigate(`/${selectedCity}/trip/${encodeURIComponent(tripId)}/${encodeURIComponent(vehicleId)}`);
                        } else {
                            navigate(`/${selectedCity}/trip/${encodeURIComponent(tripId)}`);
                        }
                    }}
                />
            )}
        </div>
    );
});

DetailPanelContent.displayName = 'DetailPanelContent';
