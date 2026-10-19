import { useTranslation } from 'react-i18next';
import { Info, MapPin, MapPinOff, Snowflake, Accessibility, Zap, History } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { IconTooltip } from '@/components/IconTooltip';
import { SignalMark } from '@/components/SignalMark';
import type { VehicleHeroProps } from './types';
import { TripEndedNotice } from './TripEndedNotice';
import { FALLBACK_ROUTE_COLOR } from '@/config/constants';
import { getDelayStatus } from '@/domain/delay';
import { safeHexColor } from '@/lib/color';
import { getRouteTypeI18nKey } from '@/domain/routes';
import { delaySourceOf, vehicleNotice, type DelaySource } from '@/domain/vehicles';
import { useNow } from '@/hooks/useNow';

export const VehicleHero = ({
    displayVehicle,
    isFollowing,
    onToggleFollow,
    isDetailLoading,
    hasEnrichment,
    hasEnded,
}: VehicleHeroProps) => {
    const { t } = useTranslation();

    if (!displayVehicle) return null;

    const delaySource = delaySourceOf(displayVehicle, hasEnrichment);

    const bgColor = safeHexColor(displayVehicle.route_color) ?? FALLBACK_ROUTE_COLOR;
    const notice = vehicleNotice(displayVehicle.state_position, displayVehicle.isStaticFallback, hasEnded);
    const noticeIconColor = notice === 'canceled' ? 'text-destructive' : 'text-amber-500';
    const noticeTextColor = notice === 'canceled' ? 'text-destructive/80' : 'text-amber-500/80';

    return (
        <Card 
            size="none"
            className="border border-border/50 ring-0 overflow-hidden relative flex flex-col shadow-sm dark:inset-shadow-[0_1px_0_rgb(255_255_255/0.07)]"
            style={{
                backgroundImage: `linear-gradient(160deg, color-mix(in srgb, ${bgColor} 18%, var(--hero-base)), color-mix(in srgb, ${bgColor} 11%, var(--hero-base)))`
            }}
        >
            <div className="relative z-10 flex flex-col p-4 pb-3">
                <div className="flex justify-between items-start gap-3">
                    <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="micro-label-widest text-muted-foreground">
                            {t('map.vehicleDetails.directionLabel')}
                        </span>
                        <h2 data-testid="vehicle-headsign" className="text-2xl font-bold tracking-tight leading-tight text-foreground/90">
                            {displayVehicle.trip_headsign ? (
                                <span className="animate-in fade-in duration-500">
                                    {displayVehicle.trip_headsign}
                                </span>
                            ) : isDetailLoading ? (
                                <Skeleton className="h-7 w-3/4 max-w-80 rounded-md bg-muted opacity-40" />
                            ) : (
                                t('map.vehicleDetails.headingToDestination')
                            )}
                        </h2>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        {isDetailLoading && (
                            <Skeleton className="w-8 h-8 rounded-full bg-neutral-800/50" />
                        )}
                        {!displayVehicle.isStaticFallback && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onToggleFollow}
                                className={cn(
                                    "rounded-full w-8 h-8 shrink-0 transition-colors cursor-pointer",
                                    isFollowing 
                                        ? "bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30" 
                                        : "text-muted-foreground hover:text-foreground bg-foreground/5 hover:bg-foreground/10 border border-border/40"
                                )}
                                aria-label={t('map.vehicleDetails.track')}
                            >
                                {isFollowing ? (
                                    <MapPin size={16} strokeWidth={2.5} />
                                ) : (
                                    <MapPinOff size={16} strokeWidth={2} />
                                )}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
            
            <div className="relative z-10 flex flex-col gap-3 px-4 pb-4">

                {!displayVehicle.isStaticFallback && (
                    <div className="flex gap-2 flex-wrap items-center">
                        <DelayBadge delay={displayVehicle.delay} delaySource={delaySource} />

                        {displayVehicle.origin_timestamp && (
                            <LiveDataAgeBadge
                                originTimestamp={displayVehicle.origin_timestamp}
                                delaySource={delaySource}
                            />
                        )}
                    </div>
                )}

                {notice && (
                    <div className="mt-1 flex items-start gap-2.5">
                        <Info size={16} className={cn("mt-0.5 shrink-0", noticeIconColor)} strokeWidth={2} />
                        <div className="flex flex-col gap-1">
                            <span className={cn("micro-label leading-none", noticeIconColor)}>
                                {t(`map.vehicleDetails.${notice}`)}
                            </span>
                            <span className={cn("text-caption leading-snug font-medium", noticeTextColor)}>
                                {t(`map.vehicleDetails.${notice}Description`)}
                            </span>
                        </div>
                    </div>
                )}

                <TripEndedNotice vehicle={displayVehicle} hasEnded={hasEnded} />
            </div>

            {displayVehicle.vehicle_descriptor && (
                <div className="relative z-10 flex gap-3 p-3 px-4 bg-foreground/3 border-t border-border/50 justify-between items-center mt-auto">
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                        {displayVehicle.vehicle_descriptor?.operator && (
                            <span className="micro-label text-muted-foreground/80 line-clamp-1">
                                {displayVehicle.vehicle_descriptor.operator}
                            </span>
                        )}
                        <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs font-semibold truncate text-foreground/90">
                                {displayVehicle.vehicle_descriptor?.vehicle_type || (() => {
                                    const typeKey = getRouteTypeI18nKey(displayVehicle.route_type);
                                    return typeKey ? t(typeKey) : '---';
                                })()}
                            </span>
                            {displayVehicle.vehicle_descriptor?.vehicle_registration_number && (
                                <span className="text-muted-foreground text-xs font-medium shrink-0">
                                    #{displayVehicle.vehicle_descriptor.vehicle_registration_number}
                                </span>
                            )}
                        </div>
                        {(displayVehicle.run_number || (displayVehicle.vehicle_id && displayVehicle.vehicle_id !== String(displayVehicle.vehicle_descriptor?.vehicle_registration_number))) && (
                            <div className="flex items-center gap-2 mt-0.5 min-w-0">
                                {displayVehicle.run_number && (
                                    <span className="micro-label text-muted-foreground shrink-0">
                                        {t('map.vehicleDetails.runNumber')} {displayVehicle.run_number}
                                    </span>
                                )}
                                {displayVehicle.vehicle_id && displayVehicle.vehicle_id !== String(displayVehicle.vehicle_descriptor?.vehicle_registration_number) && (
                                    <span className="text-muted-foreground/50 text-micro font-mono uppercase tracking-widest truncate">
                                        {displayVehicle.vehicle_id}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {(displayVehicle.vehicle_descriptor?.is_air_conditioned || 
                      displayVehicle.vehicle_descriptor?.has_usb_chargers || 
                      displayVehicle.vehicle_descriptor?.is_wheelchair_accessible) && (
                        <div className="flex gap-2 shrink-0 bg-foreground/5 p-2 rounded-lg items-center h-fit">
                            {displayVehicle.vehicle_descriptor?.is_air_conditioned && (
                                <IconTooltip label={t('amenities.airConditioned')}>
                                    <Snowflake size={14} className="text-sky-400" strokeWidth={2} aria-hidden="true" />
                                </IconTooltip>
                            )}
                            {displayVehicle.vehicle_descriptor?.has_usb_chargers && (
                                <IconTooltip label={t('amenities.usbChargers')}>
                                    <Zap size={14} className="text-amber-400" strokeWidth={2} aria-hidden="true" />
                                </IconTooltip>
                            )}
                            {(displayVehicle.vehicle_descriptor?.is_wheelchair_accessible) && (
                                <IconTooltip label={t('amenities.wheelchairAccessible')}>
                                    <Accessibility size={14} className="text-emerald-400" strokeWidth={2} aria-hidden="true" />
                                </IconTooltip>
                            )}
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
};

/** The trip's delay as a badge, led by the same broadcast mark a live departure carries on the board. */
const DelayBadge = ({ delay, delaySource }: { delay: number | null; delaySource: DelaySource }) => {
    const { t } = useTranslation();
    if (delay === null) {
        return (
            <Badge
                variant="outline"
                className="h-6 px-2.5 rounded-md text-micro font-bold uppercase tracking-wider border-transparent bg-muted/40 text-muted-foreground"
            >
                {t('map.vehicleDetails.unknownDelay')}
            </Badge>
        );
    }

    const delayMinutes = Math.round(Math.abs(delay) / 60);
    const delayStatus = getDelayStatus(delay);
    const isLate = delayStatus === 'late';
    const isEarly = delayStatus === 'early';
    return (
        <Badge
            variant="hero"
            className={cn(
                "gap-1.5",
                isLate ? "text-destructive" : isEarly ? "text-sky-500" : "text-emerald-500"
            )}
        >
            <SignalMark />
            {delaySource === 'estimated' && `${t('map.vehicleDetails.estimatedPrefix')} `}
            {isLate
                ? t('map.vehicleDetails.delayLabel', { minutes: delayMinutes || 1 })
                : isEarly
                    ? t('map.vehicleDetails.earlyLabel', { minutes: delayMinutes || 1 })
                    : t('map.vehicleDetails.onTime')}
        </Badge>
    );
};

/** Age of the vehicle's position fix; ticks on its own so the rest of the panel doesn't re-render every second. */
const LiveDataAgeBadge = ({ originTimestamp, delaySource }: { originTimestamp: string; delaySource: DelaySource }) => {
    const { t } = useTranslation();
    const now = useNow();
    const originMs = Date.parse(originTimestamp);
    if (Number.isNaN(originMs)) return null;
    const liveDataAgeSeconds = Math.max(0, Math.floor((now - originMs) / 1000));
    return (
        <Popover>
            <PopoverTrigger render={<button type="button" className="outline-none" />}>
                <Badge variant="hero" className="gap-1.5 cursor-pointer hover:brightness-95 transition-colors text-muted-foreground">
                    <History className="size-3 shrink-0" strokeWidth={2.25} />
                    <span>{t('map.vehicleDetails.liveDataAge', { seconds: liveDataAgeSeconds })}</span>
                </Badge>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="center" className="w-auto p-3 max-w-62.5">
                <span className="text-body-sm font-medium text-foreground/90 leading-tight block">
                    {t(`map.vehicleDetails.delaySource.${delaySource}`)}
                </span>
            </PopoverContent>
        </Popover>
    );
};
