import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Hand } from 'lucide-react';
import { useDepartures } from '@/hooks/data/useDepartures';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface StopTitleProps {
    title: string | undefined;
}

export const StopTitle = memo(({ title }: StopTitleProps) => {
    const { hasRequestStop } = useDepartures();
    const { t } = useTranslation();

    if (!hasRequestStop) return <span className="block truncate">{title}</span>;

    return (
        <span className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 truncate">{title}</span>
            <Popover>
                <PopoverTrigger className="inline-flex shrink-0 cursor-pointer outline-none">
                    <Hand size={18} className="text-muted-foreground opacity-60 hover:text-foreground hover:opacity-100 transition-colors" strokeWidth={2} />
                </PopoverTrigger>
                <PopoverContent side="top" className="w-auto px-3 py-1.5 min-w-30 text-center">
                    <span className="type-row">{t('map.vehicleDetails.requestStop')}</span>
                </PopoverContent>
            </Popover>
        </span>
    );
});
