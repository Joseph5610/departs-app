import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarRange, ClipboardPen, IdCard, Info, Printer, Receipt, Ticket } from 'lucide-react';
import { PosRow, PosSection } from './PointOfSaleRows';
import type { PointOfSale } from '@/types';
import { cn } from '@/lib/cn';
import { PointOfSaleHero } from '@/components/DetailPanel/PointOfSaleHero';
import { usePointOfSaleStatus } from '@/hooks/derived/usePointOfSaleStatus';
import { coversDay } from '@/domain/pointsOfSale';
import { weekdayShortNames } from '@/domain/time';

interface PointOfSaleDetailProps {
    pos: PointOfSale;
}

const SERVICE_ICONS: Record<PointOfSale['services'][number], React.ElementType> = {
    card_application: ClipboardPen,
    card_issuance: IdCard,
    coupons: CalendarRange,
    paper_tickets: Ticket,
    penalties: Receipt,
    information: Info,
    tkt_prep: Printer,
};

function formatDayRange(from: number, to: number, days: string[]): string {
    if (from === to) return days[from] || '';
    return `${days[from]}–${days[to]}`;
}

export const PointOfSaleDetail = ({ pos }: PointOfSaleDetailProps) => {
    const { t, i18n } = useTranslation();
    const weekdayNames = useMemo(() => weekdayShortNames(i18n.resolvedLanguage), [i18n.resolvedLanguage]);
    const { today, status } = usePointOfSaleStatus(pos);

    return (
        <div className="flex flex-col gap-4 pb-4">
            <PointOfSaleHero pos={pos} status={status} />

            {pos.openingHours && pos.openingHours.length > 0 && (
                <PosSection title={t('pos.openingHours')}>
                    {pos.openingHours.map((oh) => {
                        const isToday = coversDay(oh, today);
                        return (
                            <div key={`${oh.from}-${oh.to}-${oh.hours}`} className="flex items-center justify-between gap-3 px-3 py-2.5 text-body-sm border-b border-border/40 last:border-b-0">
                                <span className={cn("font-medium", isToday ? "text-foreground" : "text-muted-foreground")}>{formatDayRange(oh.from, oh.to, weekdayNames)}</span>
                                <span className={cn("tabular-nums text-right", isToday ? "font-medium text-foreground" : "text-muted-foreground")}>{oh.hours.replace(/,/g, ', ')}</span>
                            </div>
                        );
                    })}
                </PosSection>
            )}

            {pos.services && pos.services.length > 0 && (
                <PosSection title={t('pos.servicesTitle')}>
                    {pos.services.map((srv) => (
                        <PosRow key={srv} icon={SERVICE_ICONS[srv]}>{t(`pos.services.${srv}`, srv)}</PosRow>
                    ))}
                </PosSection>
            )}
        </div>
    );
};
