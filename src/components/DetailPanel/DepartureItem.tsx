import { format, parseISO, type Locale } from 'date-fns';
import { Countdown } from '../Countdown';
import { DelayDelta } from './DelayDelta';
import { cn } from '../../utils/cn';
import { getCatchStatus } from '../../utils/transitLogic';
import { formatDelay } from '../../utils/dateUtils';
import type { Departure } from '../../types/transit';
import { useTranslation } from 'react-i18next';

interface DepartureItemProps {
    departure: Departure;
    onDepartureClick: (tripId: string, vehicleId?: string, initialData?: Partial<Departure>) => void;
    stopDistanceInfo: {
        distance: number;
        time: number;
        isAtStop: boolean;
        showCatchIndicator: boolean;
    } | null;
    isTrainStop?: boolean;
    locale: Locale;
}

export const DepartureItem = ({
    departure,
    onDepartureClick,
    stopDistanceInfo,
    isTrainStop,
    locale
}: DepartureItemProps) => {
    const { t } = useTranslation();
    const dep = departure;

    const catchStatus = stopDistanceInfo
        ? getCatchStatus(stopDistanceInfo.distance, dep.timestamp, stopDistanceInfo.isAtStop)
        : null;

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => dep.tripId && onDepartureClick(dep.tripId, dep.vehicleId, dep)}
            onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && dep.tripId) {
                    onDepartureClick(dep.tripId, dep.vehicleId, dep);
                }
            }}
            className={`flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 transition-all
                ${dep.tripId ? 'hover:bg-white/10 hover:border-white/20 cursor-pointer active:scale-[0.98]' : ''}
            `}
        >
            <div className="flex items-center gap-4">
                <div className="flex flex-col">
                    <div className="text-white font-semibold leading-tight">{dep.headsign}</div>
                    <div className="text-zinc-500 text-[10px] mt-1 flex items-center gap-2">
                        <span className="tabular-nums">{format(parseISO(dep.scheduled), 'HH:mm', {
                            locale: locale
                        })}</span>
                        {isTrainStop && dep.platform && (
                            <span className="bg-white/10 px-1.5 py-0.5 rounded text-white font-bold tracking-wider">
                                {dep.platform}
                            </span>
                        )}
                        <div className="flex items-center">
                            {typeof dep.delay === 'number' && dep.delay !== 0 && (
                                <span className={cn(
                                    "font-bold tabular-nums",
                                    dep.delay > 0 ? "text-rose-400" : "text-sky-400"
                                )}>
                                    {formatDelay(dep.delay)}
                                </span>
                            )}
                            <DelayDelta delta={dep.delayDelta || 0} lastUpdate={dep.lastDelayUpdate} isInline={typeof dep.delay === 'number' && dep.delay !== 0} />
                        </div>
                    </div>
                </div>
            </div>
            <div className="text-right flex flex-col items-end justify-center min-w-[100px]">
                <div className="text-lg font-bold text-emerald-400 tabular-nums leading-none">
                    <Countdown timestamp={dep.timestamp} />
                </div>
                {stopDistanceInfo?.showCatchIndicator && catchStatus && (
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold whitespace-nowrap">
                        <div className={cn(
                            "px-1.5 py-0.5 rounded-md flex items-center gap-1",
                            catchStatus.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' :
                            catchStatus.status === 'warning' ? 'bg-amber-500/10 text-amber-400' :
                            'bg-rose-500/10 text-rose-400'
                        )}>
                            <span className="text-[8px] leading-none">
                                {catchStatus.status === 'success' ? '🟢' :
                                    catchStatus.status === 'warning' ? '🟡' : '🔴'}
                            </span>
                            <span className="uppercase tracking-tighter">
                                {t(`map.departures.catchStatusCompact.${catchStatus.status}`)}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
