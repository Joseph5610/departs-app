import { useMemo } from 'react';
import { useStops } from '@/hooks/data/useStops';
import type { Platform } from '@/types';
import { memoizeLast } from '@/lib/memoize';
import { interchangeIndex, interchangesWithoutLine } from '@/domain/stops';

const buildInterchangeIndex = memoizeLast(interchangeIndex);
const NO_PLATFORMS: Platform[] = [];

/**
 * The modes a rider can change to at a stop (PID `stop_icons` codes), looked up by stop name.
 */
export const useInterchanges = () => {
    const { model } = useStops();
    const index = buildInterchangeIndex(model?.platforms ?? NO_PLATFORMS);

    return useMemo(() => {
        const withoutLine = (name: string | undefined, line: string) => interchangesWithoutLine(index, name, line);
        return {
            /** Interchanges at a departure's destination, without the departing metro line itself. */
            forHeadsign: withoutLine,
            /** Interchanges at a timeline stop, without the metro line the vehicle itself runs on. */
            forStop: withoutLine,
        };
    }, [index]);
};
