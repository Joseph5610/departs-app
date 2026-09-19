import { toSecs, wrapDaySeconds } from './time';

/**
 * Whether a held connection may leave before the arriving trip makes it: its expected arrival plus
 * the transfer time exceeds the onward departure plus how long that departure waits. Wrapped so a
 * `24:05` arrival and a `00:10` departure compare as minutes apart, not a day.
 */
export function isConnectionAtRisk(
    arrivalTime: string,
    delaySecs: number | null,
    minTransferS: number,
    departureTime: string,
    maxWaitS: number
): boolean {
    if (delaySecs === null) return false;
    return wrapDaySeconds(toSecs(arrivalTime) + delaySecs + minTransferS - toSecs(departureTime)) > maxWaitS;
}
