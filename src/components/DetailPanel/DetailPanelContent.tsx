import { memo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { VehicleDetail } from './VehicleDetail/VehicleDetail';
import { useSelectionStore } from '@/state/selectionStore';
import { useVehicleDetail } from '@/hooks/data/useVehicleDetail';
import { useRouteParams } from '@/hooks/useRouteParams';
import { useSelectedStop } from '@/hooks/derived/useSelectedStop';
import { useSelectedVehicle } from '@/hooks/derived/useSelectedVehicle';
import { DepartureBoard } from './DepartureBoard/DepartureBoard';
import { closeDetail, navigate } from '@/lib/history';
import { paths } from '@/lib/routes';
import type { AppError } from '@/types';
import { usePreferencesStore } from '@/state/preferencesStore';


import { PointOfSaleDetail } from './PointOfSaleDetail';
import { usePointsOfSale } from '@/hooks/data/usePointsOfSale';

/**
 * DetailPanelContent
 *
 * Orchestrator for the content area of the DetailPanel.
 * Switches between VehicleDetail, DepartureBoard, and PointOfSaleDetail based on selection.
 */
export const DetailPanelContent = memo(() => {
    const isFollowing = useSelectionStore(s => s.isFollowing);
    const setIsFollowing = useSelectionStore(s => s.actions.setIsFollowing);
    const resetStopSelection = useSelectionStore(s => s.actions.resetStopSelection);
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const { tripId, stopId, posId } = useRouteParams();

    const selectedStop = useSelectedStop();
    const selectedVehicle = useSelectedVehicle();

    const { data: posList } = usePointsOfSale();
    const selectedPos = posId ? posList?.find((p) => p.id === posId) : null;

    const { 
        data: vehicleDetail, 
        isFetching: loadingDetail,
        isError: isVehicleError,
        error: vehicleError,
        refetch: refetchVehicle
    } = useVehicleDetail();

    const showDepartureBoard = selectedStop && !selectedVehicle;
    const { t } = useTranslation();

    useEffect(() => {
        if (selectedVehicle && isVehicleError && !loadingDetail && !vehicleDetail) {
            toast.error(t('toasts.vehicleNotFound'));
            closeDetail(paths.city(selectedCity));
        }
    }, [selectedVehicle, isVehicleError, loadingDetail, vehicleDetail, t, selectedCity]);

    useEffect(() => {
        if (tripId) {
            setIsFollowing(true);
        } else {
            setIsFollowing(false);
        }
    }, [tripId, setIsFollowing]);

    const filterResetForStop = useRef<string | null | undefined>(undefined);
    useEffect(() => {
        if (filterResetForStop.current === stopId) return;
        filterResetForStop.current = stopId;
        resetStopSelection();
    }, [stopId, resetStopSelection]);

    return (
        <div className="flex flex-col gap-0 pt-0">
            {selectedPos ? (
                <PointOfSaleDetail pos={selectedPos} />
            ) : (
                <>
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
                            onDepartureClick={(tripId, vehicleId) => {
                                navigate(paths.trip(selectedCity, tripId, vehicleId));
                            }}
                        />
                    )}
                </>
            )}
        </div>
    );
});

DetailPanelContent.displayName = 'DetailPanelContent';
