import { Children, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Info, MapPin, MapPinOff, History, ArrowLeftRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AmenityIcons } from '@/components/AmenityIcons';
import { ButtonTooltip } from '@/components/ButtonTooltip';
import { SignalMark } from '@/components/SignalMark';
import type { VehicleHeroProps } from './types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TripEndedNotice } from './TripEndedNotice';
import { FALLBACK_ROUTE_COLOR } from '@/config/constants';
import { getDelayStatus } from '@/domain/delay';
import { safeHexColor } from '@/lib/color';
import { getRouteTypeI18nKey } from '@/domain/routes';
import { delaySourceOf, fleetRegisterUrl, vehicleIdentifiers, vehicleNotice, type DelaySource } from '@/domain/vehicles';
import { useNow } from '@/hooks/useNow';
import { usePreferencesStore } from '@/state/preferencesStore';
import { HeroFooter } from '@/components/DetailPanel/HeroFooter';
import { HeroFooterSkeleton } from './VehicleDetailSkeleton';
import { TapHint } from '@/components/TapHint';
import { useVehicleTwin } from '@/hooks/derived/useVehicleTwin';
import { FRONTEND_CITIES_CONFIG } from '@/config/cities';
import { navigate } from '@/lib/history';
import { paths } from '@/lib/routes';

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

    const typeKey = getRouteTypeI18nKey(displayVehicle.route_type);
    const vehicleTypeLabel = displayVehicle.vehicle_descriptor?.vehicle_type || (typeKey ? t(typeKey) : '---');
    const descriptor = displayVehicle.vehicle_descriptor;
    const ids = vehicleIdentifiers(displayVehicle.vehicle_id, descriptor?.vehicle_registration_number, displayVehicle.run_number);

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
                    <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                        <span className="type-label text-muted-foreground">
                            {t('map.vehicleDetails.directionLabel')}
                        </span>
                        <h2 data-testid="vehicle-headsign" className="type-display text-foreground">
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
                        {!displayVehicle.isStaticFallback && (
                            <Button
                                variant="pill"
                                aria-pressed={isFollowing}
                                size="icon-xs"
                                onClick={onToggleFollow}
                                className={cn("shrink-0", isFollowing && "bg-selected text-foreground hover:bg-selected")}
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
                    <Alert variant={notice === 'canceled' ? 'destructive' : 'warning'}>
                        <Info />
                        <AlertTitle className="text-current">{t(`map.vehicleDetails.${notice}`)}</AlertTitle>
                        <AlertDescription className="type-note">{t(`map.vehicleDetails.${notice}Description`)}</AlertDescription>
                    </Alert>
                )}

                <TripEndedNotice vehicle={displayVehicle} hasEnded={hasEnded} />

                <VehicleTwinLink />
            </div>

            {descriptor ? (
                <HeroFooter className="mt-auto flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="type-meta font-medium text-foreground">{vehicleTypeLabel}</span>
                        {descriptor.operator && (
                            <span className="line-clamp-1 type-note text-muted-foreground">{descriptor.operator}</span>
                        )}
                        <IdLine>
                            {ids.fleetNumber && <RegisterLink value={ids.fleetNumber} text={`#${ids.fleetNumber}`} operator={descriptor.operator} />}
                            {ids.plate && <RegisterLink value={ids.plate} text={ids.plate} operator={descriptor.operator} />}
                            {ids.run && <span>{t('map.vehicleDetails.runNumber')} {ids.run}</span>}
                        </IdLine>
                    </div>

                    <AmenityIcons
                        wheelchairAccessible={displayVehicle.vehicle_descriptor?.is_wheelchair_accessible}
                        airConditioned={displayVehicle.vehicle_descriptor?.is_air_conditioned}
                        usbChargers={displayVehicle.vehicle_descriptor?.has_usb_chargers}
                    />
                </HeroFooter>
            ) : isDetailLoading && <HeroFooterSkeleton />}
        </Card>
    );
};

/** The same vehicle in the neighbouring network that also reports it, where it has its own zones and destination. */
const VehicleTwinLink = () => {
    const { t } = useTranslation();
    const twin = useVehicleTwin();
    const network = twin ? FRONTEND_CITIES_CONFIG[twin.city]?.networkLabel : undefined;
    if (!twin || !network) return null;
    return (
        <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(paths.trip(twin.city, twin.tripId, twin.vehicleId))}
            className="self-start gap-1.5 pl-2.5"
        >
            <ArrowLeftRight strokeWidth={1.75} className="size-3.75" />
            {t('map.vehicleDetails.otherNetwork', { network })}
        </Button>
    );
};

/** A vehicle's identifiers in one muted line, a dot between each that is present. */
const IdLine = ({ children }: { children: React.ReactNode }) => {
    const ids = Children.toArray(children);
    if (ids.length === 0) return null;
    return (
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 type-note text-muted-foreground">
            {ids.map((id, i) => <Fragment key={i}>{i > 0 && <span aria-hidden="true">·</span>}{id}</Fragment>)}
        </div>
    );
};

/** A fleet number or plate, linked to its seznam-autobusu.cz page when it pins down one vehicle. */
const RegisterLink = ({ value, text, operator }: { value: string; text: string; operator?: string }) => {
    const { t } = useTranslation();
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const url = fleetRegisterUrl(selectedCity, operator, value);
    const className = 'shrink-0 tabular-nums';
    if (!url) return <span className={className}>{text}</span>;
    return (
        <ButtonTooltip label={t('map.vehicleDetails.fleetRegisterLink')}>
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(className, 'underline decoration-dotted underline-offset-2 hover:text-foreground transition-colors')}
            >
                {text}
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
        <TapHint side="bottom" className="rounded-full" hint={t(`map.vehicleDetails.delaySource.${delaySource}`)}>
            <Badge variant="hero" className="gap-1.5 text-muted-foreground">
                <History className="size-3 shrink-0" strokeWidth={2.25} />
                <span>{t('map.vehicleDetails.liveDataAge', { seconds: liveDataAgeSeconds })}</span>
            </Badge>
        </TapHint>
    );
};
