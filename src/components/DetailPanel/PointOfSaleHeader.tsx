import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { NavigatePill } from '@/components/DetailPanel/NavigatePill';
import { PointOfSaleTypeIcon } from '@/components/DetailPanel/PointOfSaleTypeIcon';
import type { PointOfSale } from '@/types';

interface PointOfSaleHeaderProps {
    pos: PointOfSale;
}

/** Sticky subheader of a point of sale, laid out like a stop board's: directions pill, then its kind. */
export const PointOfSaleHeader = ({ pos }: PointOfSaleHeaderProps) => {
    const { t } = useTranslation();
    const target = useMemo<[number, number]>(() => [pos.lon, pos.lat], [pos.lon, pos.lat]);

    return (
        <div className="px-6 pb-3 shrink-0 flex flex-col">
            <div className="flex w-full min-h-8 items-center gap-4 text-body-sm text-muted-foreground">
                <NavigatePill target={target} />
                <span className="flex min-w-0 items-center gap-1.5">
                    <PointOfSaleTypeIcon type={pos.type} size={14} strokeWidth={1.5} className="shrink-0" />
                    <span className="truncate">{t(`pos.types.${pos.type}`, pos.type)}</span>
                </span>
            </div>
        </div>
    );
};
