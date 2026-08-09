import React from 'react';
import { useTranslation } from 'react-i18next';
import { Hand } from 'lucide-react';
import { useDepartures } from '../../../hooks/data/useDepartures';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';

interface StopTitleProps {
    title: string | undefined;
}

export const StopTitle: React.FC<StopTitleProps> = React.memo(({ title }) => {
    const { hasRequestStop } = useDepartures();
    const { t } = useTranslation();

    return (
        <span className="flex items-center gap-2">
            {title}
            {hasRequestStop && (
                <Popover>
                    <PopoverTrigger className="flex items-center mt-0.5 cursor-pointer outline-none">
                        <Hand size={18} className="text-muted-foreground opacity-60 hover:text-foreground hover:opacity-100 transition-colors" strokeWidth={2} />
                    </PopoverTrigger>
                    <PopoverContent side="top" className="w-auto px-3 py-1.5 min-w-30 text-center">
                        <span className="text-sm font-medium">{t('map.vehicleDetails.requestStop', 'Request Stop')}</span>
                    </PopoverContent>
                </Popover>
            )}
        </span>
    );
});
