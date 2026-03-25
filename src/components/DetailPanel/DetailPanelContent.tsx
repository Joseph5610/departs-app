import { memo } from 'react';
import { VehicleDetail } from './VehicleDetail/VehicleDetail';
import { useSelection, useViewport } from '../../state/MapStateProvider';
import { useVehicleDetail } from '../../hooks/data/useVehicleDetail';
import { useSelectedStop } from '../../hooks/derived/useSelectedStop';
import { useSelectedVehicle } from '../../hooks/derived/useSelectedVehicle';
import { DepartureBoard } from './DepartureBoard/DepartureBoard';
import { Stack } from '@/components/ui/layout';

/**
 * DetailPanelContent
 *
 * Orchestrator for the content area of the DetailPanel.
 * Switches between VehicleDetail and DepartureBoard based on selection.
 */
export const DetailPanelContent = memo(() => {
    const { state: selectionState, actions: selectionActions } = useSelection();
    const { isFollowing } = selectionState;

    // Derived State
    const selectedStop = useSelectedStop();
    const selectedVehicle = useSelectedVehicle();

    // Data Hooks
    const { data: vehicleDetail, isFetching: loadingDetail } = useVehicleDetail();

    const { actions: vpActions } = useViewport();
    const { handleDepartureClick: onDepartureClick } = vpActions;
    const { setIsFollowing } = selectionActions;

    const showDepartureBoard = selectedStop && !selectedVehicle;

    return (
        <Stack gap={4} className="pt-1">
            <VehicleDetail
                selectedVehicle={selectedVehicle}
                vehicleDetail={vehicleDetail || null}
                loadingDetail={loadingDetail}
                isFollowing={isFollowing}
                onToggleFollow={() => setIsFollowing(!isFollowing)}
            />

            {showDepartureBoard && (
                <DepartureBoard 
                    selectedStop={selectedStop}
                    onDepartureClick={onDepartureClick}
                />
            )}
        </Stack>
    );
});

DetailPanelContent.displayName = 'DetailPanelContent';
