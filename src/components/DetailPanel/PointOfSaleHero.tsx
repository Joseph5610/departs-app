import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Banknote, CreditCard, MapPin, Smartphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { HeroFooter } from '@/components/DetailPanel/HeroFooter';
import { weekdayShortNames } from '@/domain/time';
import type { OpeningStatus } from '@/domain/pointsOfSale';
import type { PointOfSale } from '@/types';

const PAY_ICONS: Record<PointOfSale['payMethods'][number], React.ElementType> = {
    cash: Banknote,
    card: CreditCard,
    contactless: Smartphone,
};

type Tone = 'open' | 'soon' | 'closed';

const TONE_TEXT: Record<Tone, string> = {
    open: 'text-tint-mint',
    soon: 'text-tint-amber',
    closed: 'text-tint-red',
};

const TONE_TINT: Record<Tone, string> = {
    open: 'var(--tint-mint)',
    soon: 'var(--tint-amber)',
    closed: 'var(--tint-red)',
};

const toneOf = (status: OpeningStatus): Tone =>
    status.kind === 'closed' ? 'closed' : status.kind === 'open' && status.closingSoon ? 'soon' : 'open';

interface PointOfSaleHeroProps {
    pos: PointOfSale;
    status: OpeningStatus | null;
}

/** The point of sale's lead card, built like the vehicle hero: whether it is open now, how to pay, and where it is. */
export const PointOfSaleHero = ({ pos, status }: PointOfSaleHeroProps) => {
    const { t } = useTranslation();
    const tone = status ? toneOf(status) : null;
    const hasBody = !!status || pos.payMethods.length > 0;

    return (
        <Card
            size="none"
            className="overflow-hidden relative flex flex-col"
            style={tone ? {
                backgroundImage: `linear-gradient(160deg, color-mix(in srgb, ${TONE_TINT[tone]} 9%, var(--hero-base)), var(--hero-base))`
            } : { backgroundColor: 'var(--hero-base)' }}
        >
            {hasBody && (
                <div className="flex flex-col gap-3 p-3.5">
                    {status && tone && <OpeningState status={status} tone={tone} />}
                    {pos.payMethods.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {pos.payMethods.map(pm => {
                                const Icon = PAY_ICONS[pm];
                                return (
                                    <Badge key={pm} variant="info">
                                        <Icon size={14} strokeWidth={1.5} />
                                        {t(`pos.payMethods.${pm}`, pm)}
                                    </Badge>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {pos.address && (
                <HeroFooter className={cn("flex items-start gap-2 type-meta text-foreground/80", !hasBody && "border-t-0")}>
                    <MapPin size={14} strokeWidth={1.5} className="mt-0.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 wrap-break-word">{pos.address}</span>
                </HeroFooter>
            )}
        </Card>
    );
};

/** "Open" with when it closes, or "Closed" with when it opens next. */
const OpeningState = ({ status, tone }: { status: OpeningStatus; tone: Tone }) => {
    const { t, i18n } = useTranslation();
    const weekdayNames = useMemo(() => weekdayShortNames(i18n.resolvedLanguage), [i18n.resolvedLanguage]);

    const state = status.kind === 'nonstop' ? t('pos.status.nonstop')
        : status.kind === 'closed' ? t('pos.status.closed')
        : status.closingSoon ? t('pos.status.closingSoon')
        : t('pos.status.open');

    let note: string | null = null;
    if (status.kind === 'open') note = t('pos.status.closesAt', { time: status.closesAt });
    else if (status.kind === 'closed' && status.opensAt !== null && status.inDays !== null) {
        note = status.inDays === 0 ? t('pos.status.opensAt', { time: status.opensAt })
            : status.inDays === 1 ? t('pos.status.opensTomorrow', { time: status.opensAt })
            : t('pos.status.opensOn', { day: weekdayNames[status.inDays % 7], time: status.opensAt });
    }

    return (
        <div className="flex flex-col gap-0.5">
            <span className={cn("type-section", TONE_TEXT[tone])}>{state}</span>
            {note && <span className="type-meta text-muted-foreground">{note}</span>}
        </div>
    );
};
