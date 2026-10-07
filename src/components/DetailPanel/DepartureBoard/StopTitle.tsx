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

    const text = title?.replace(/,(?=\S)/g, ',\u200B') ?? '';
    if (!hasRequestStop) return <span className="line-clamp-2 wrap-anywhere">{text}</span>;

    const lastWordStart = Math.max(text.lastIndexOf(' '), text.lastIndexOf('\u200B')) + 1;

    return (
        <span className="line-clamp-2 wrap-anywhere">
            {text.slice(0, lastWordStart)}
            {/* Keeps the icon on the same line as the last word. */}
            <span className="whitespace-nowrap">
                {text.slice(lastWordStart)}
                <Popover>
                    <PopoverTrigger className="relative -top-0.5 ml-2 inline-flex align-middle cursor-pointer outline-none">
                        <Hand size={18} className="text-muted-foreground opacity-60 hover:text-foreground hover:opacity-100 transition-colors" strokeWidth={2} />
                    </PopoverTrigger>
                    <PopoverContent side="top" className="w-auto px-3 py-1.5 min-w-30 text-center">
                        <span className="text-sm font-medium">{t('map.vehicleDetails.requestStop')}</span>
                    </PopoverContent>
                </Popover>
            </span>
        </span>
    );
});
