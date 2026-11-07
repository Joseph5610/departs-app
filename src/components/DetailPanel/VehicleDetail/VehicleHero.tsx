import { useTranslation } from 'react-i18next';
import { Info, MapPin, MapPinOff, Snowflake, Accessibility, Zap, History } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { IconTooltip } from '@/components/IconTooltip';
import { ButtonTooltip } from '@/components/ButtonTooltip';
import { SignalMark } from '@/components/SignalMark';
import type { VehicleHeroProps } from './types';
import { HeroNotice } from './HeroNotice';
import { TripEndedNotice } from './TripEndedNotice';
import { FALLBACK_ROUTE_COLOR } from '@/config/constants';
import { getDelayStatus } from '@/domain/delay';
import { safeHexColor } from '@/lib/color';
import { getRouteTypeI18nKey } from '@/domain/routes';
import { delaySourceOf, fleetRegisterUrl, vehicleNotice, type DelaySource } from '@/domain/vehicles';
import { useNow } from '@/hooks/useNow';
import { usePreferencesStore } from '@/state/preferencesStore';
import { HeroFooter } from '@/components/DetailPanel/HeroFooter';

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
    const noticeIconColor = notice === 'canceled' ? 'text-destructive' : 'text-tint-amber';
    const noticeTextColor = notice === 'canceled' ? 'text-destructive/80' : 'text-tint-amber';

    return (
        <Card 
            size="none"
            className="overflow-hidden relative flex flex-col"
            style={{
                backgroundImage: `linear-gradient(160deg, color-mix(in srgb, ${bgColor} 18%, var(--hero-base)), color-mix(in srgb, ${bgColor} 11%, var(--hero-base)))`
            }}
        >
            <div className="relative z-10 flex flex-col p-3.5 pb-2.5">
                <div className="flex justify-between items-start gap-3">
                    <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="type-label text-muted-foreground">
                            {t('map.vehicleDetails.directionLabel')}
                        </span>
                        <h2 data-testid="vehicle-headsign" className="type-title text-foreground">
                            {displayVehicle.trip_headsign ? (
                                <span className="animate-in fade-in duration-500">
                                    {displayVehicle.trip_headsign}
                                </span>
                            ) : isDetailLoading ? (
                                <Skeleton className="h-7 w-3/4 max-w-80 rounded-badge bg-muted opacity-40" />
                            ) : (
                                t('map.vehicleDetails.headingToDestination')
                            )}
                        </h2>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        {isDetailLoading && (
                            <Skeleton className="size-8 rounded-full" />
                        )}
                        {!displayVehicle.isStaticFallback && (
                            <Button
                                variant={isFollowing ? 'selected' : 'pill'}
                                size="icon-xs"
                                onClick={onToggleFollow}
                                className="shrink-0"
                                aria-label={t('map.vehicleDetails.track')}
                            >
                                {isFollowing ? (
                                    <MapPin size={16} strokeWidth={2.5} className="text-tint-mint" />
                                ) : (
                                    <MapPinOff size={16} strokeWidth={2} />
                                )}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
            
            <div className="relative z-10 flex flex-col gap-3 px-3.5 pb-3.5">

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
                    <HeroNotice
                        icon={Info}
                        title={t(`map.vehicleDetails.${notice}`)}
                        description={t(`map.vehicleDetails.${notice}Description`)}
                        tone={noticeIconColor}
                        descriptionTone={noticeTextColor}
                    />
                )}

                <TripEndedNotice vehicle={displayVehicle} hasEnded={hasEnded} />
            </div>

            {displayVehicle.vehicle_descriptor && (
                <HeroFooter className="mt-auto flex items-center justify-between gap-3">
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                        {displayVehicle.vehicle_descriptor?.operator && (
                            <span className="type-label text-muted-foreground line-clamp-1">
                                {displayVehicle.vehicle_descriptor.operator}
                            </span>
                        )}
                        <div className="flex items-center gap-1.5 min-w-0">
                            <span className="type-row truncate text-foreground">
                                {displayVehicle.vehicle_descriptor?.vehicle_type || (() => {
                                    const typeKey = getRouteTypeI18nKey(displayVehicle.route_type);
                                    return typeKey ? t(typeKey) : '---';
                                })()}
                            </span>
                            {displayVehicle.vehicle_descriptor.vehicle_registration_number && (
                                <VehicleNumber
                                    number={displayVehicle.vehicle_descriptor.vehicle_registration_number}
                                    operator={displayVehicle.vehicle_descriptor.operator}
                                />
                            )}
                        </div>
                        {(displayVehicle.run_number || (displayVehicle.vehicle_id && displayVehicle.vehicle_id !== String(displayVehicle.vehicle_descriptor?.vehicle_registration_number))) && (
                            <div className="flex items-center gap-2 mt-0.5 min-w-0">
                                {displayVehicle.run_number && (
                                    <span className="type-label text-muted-foreground shrink-0">
                                        {t('map.vehicleDetails.runNumber')} {displayVehicle.run_number}
                                    </span>
                                )}
                                {displayVehicle.vehicle_id && displayVehicle.vehicle_id !== String(displayVehicle.vehicle_descriptor?.vehicle_registration_number) && (
                                    <span className="truncate font-mono type-micro font-normal tracking-widest text-muted-foreground uppercase">
                                        {displayVehicle.vehicle_id}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {(displayVehicle.vehicle_descriptor?.is_air_conditioned || 
                      displayVehicle.vehicle_descriptor?.has_usb_chargers || 
                      displayVehicle.vehicle_descriptor?.is_wheelchair_accessible) && (
                        <div className="flex h-fit shrink-0 items-center gap-2 rounded-nested bg-fill p-2">
                            {displayVehicle.vehicle_descriptor?.is_air_conditioned && (
                                <IconTooltip label={t('amenities.airConditioned')}>
                                    <Snowflake size={14} strokeWidth={2} className="text-sky-400" aria-hidden="true" />
                                </IconTooltip>
                            )}
                            {displayVehicle.vehicle_descriptor?.has_usb_chargers && (
                                <IconTooltip label={t('amenities.usbChargers')}>
                                    <Zap size={14} strokeWidth={2} className="text-amber-400" aria-hidden="true" />
                                </IconTooltip>
                            )}
                            {(displayVehicle.vehicle_descriptor?.is_wheelchair_accessible) && (
                                <IconTooltip label={t('amenities.wheelchairAccessible')}>
                                    <Accessibility size={14} strokeWidth={2} className="text-emerald-400" aria-hidden="true" />
                                </IconTooltip>
                            )}
                        </div>
                    )}
                </HeroFooter>
            )}
        </Card>
    );
};

/** The vehicle's number, linked to its seznam-autobusu.cz page when the number pins down one vehicle. */
const VehicleNumber = ({ number, operator }: { number: string | number; operator?: string }) => {
    const { t } = useTranslation();
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const url = fleetRegisterUrl(selectedCity, operator, number);
    const className = 'text-muted-foreground type-note shrink-0';
    if (!url) return <span className={className}>#{number}</span>;
    return (
        <ButtonTooltip label={t('map.vehicleDetails.fleetRegisterLink')}>
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(className, 'underline decoration-dotted underline-offset-2 hover:text-foreground transition-colors')}
            >
                #{number}
            </a>
        </ButtonTooltip>
    );
};

/** The trip's delay as a badge, led by the same broadcast mark a live departure carries on the board. */
const DelayBadge = ({ delay, delaySource }: { delay: number | null; delaySource: DelaySource }) => {
    const { t } = useTranslation();
    if (delay === null) {
        return (
            <Badge variant="hero" className="text-muted-foreground">
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
                isLate ? "text-destructive" : isEarly ? "text-tint-sky" : "text-tint-mint"
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
                <span className="type-meta text-foreground/90 block">
                    {t(`map.vehicleDetails.delaySource.${delaySource}`)}
                </span>
            </PopoverContent>
        </Popover>
    );
};
