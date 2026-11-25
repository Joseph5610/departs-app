import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ButtonGroup } from '@/components/ui/button-group';
import { useIndoorMap } from '@/hooks/derived/useIndoorMap';
import { useIndoorView } from '@/hooks/features/useIndoorView';
import { useViewportStore } from '@/state/viewportStore';
import { adjacentIndoorLevel } from '@/domain/indoor';
import { cn } from '@/lib/cn';
import { MapControlButton, MapControlValue } from './MapControlButton';

interface FloorSwitcherProps {
    /** The glass pill it sits in, matching the controls around it. */
    className: string;
    /** Sized for the phone, riding above the sheet. */
    inSheet?: boolean;
}

/** The floor of the station plan in view, with steps to the others; nothing for a plan of a single floor. */
export const FloorSwitcher = ({ className, inSheet = false }: FloorSwitcherProps) => {
    const { t } = useTranslation();
    const { station, levels, level } = useIndoorMap(useIndoorView());
    const setIndoorFloor = useViewportStore(s => s.actions.setIndoorFloor);
    if (station === null || levels.length < 2) return null;

    const above = adjacentIndoorLevel(levels, level, 'up');
    const below = adjacentIndoorLevel(levels, level, 'down');
    return (
        <ButtonGroup orientation="vertical" aria-label={t('map.controls.floor')} className={cn('pointer-events-auto', className)}>
            <MapControlButton inSheet={inSheet} disabled={above === null} onClick={() => above !== null && setIndoorFloor({ station, level: above })} title={t('map.controls.floorUp')} testId="floor-up">
                <ChevronUp size={20} strokeWidth={1.5} />
            </MapControlButton>
            <MapControlValue inSheet={inSheet} testId="floor-level">{level}</MapControlValue>
            <MapControlButton inSheet={inSheet} disabled={below === null} onClick={() => below !== null && setIndoorFloor({ station, level: below })} title={t('map.controls.floorDown')} testId="floor-down">
                <ChevronDown size={20} strokeWidth={1.5} />
            </MapControlButton>
        </ButtonGroup>
    );
};
