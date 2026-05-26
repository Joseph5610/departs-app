import { memo } from 'react';
import { VehicleDetail } from './VehicleDetail/VehicleDetail';
import { useSelectionStore } from '../../state/selectionStore';
import { useVehicleDetail } from '../../hooks/data/useVehicleDetail';
import { useSelectedStop } from '../../hooks/derived/useSelectedStop';
import { useSelectedVehicle } from '../../hooks/derived/useSelectedVehicle';
import { DepartureBoard } from './DepartureBoard/DepartureBoard';
import { Stack } from '@/components/ui/layout';
import type { AppError } from '@/types/error';

/**
 * DetailPanelContent
 *
 * Orchestrator for the content area of the DetailPanel.
 * Switches between VehicleDetail and DepartureBoard based on selection.
 */
export const DetailPanelContent = memo(() => {
    const isFollowing = useSelectionStore(s => s.isFollowing);
    const setIsFollowing = useSelectionStore(s => s.actions.setIsFollowing);

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

    const { selectVehicle } = useSelectionStore(s => s.actions);

    const showDepartureBoard = selectedStop && !selectedVehicle;

    return (
        <Stack gap={0} className="pt-0">
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
                        selectVehicle(tripId, vehicleId || null, true);
                    }}
                />
            )}
        </Stack>
    );
});

DetailPanelContent.displayName = 'DetailPanelContent';
