import { useState } from 'react';
import { Earth } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useVisibleCities } from '@/hooks/data/useCities';
import { usePreferencesStore } from '@/state/preferencesStore';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { CitySelectionList } from './CitySelectionList';
import { cn } from '@/lib/cn';
import { useSelectCity } from '@/hooks/features/useSelectCity';

interface CitySwitcherProps {
    className?: string;
    variant?: "default" | "destructive" | "secondary" | "ghost" | "link" | "tinted";
}

export const CitySwitcher = ({ className, variant = "tinted" }: CitySwitcherProps) => {
    const { t } = useTranslation();
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const [open, setOpen] = useState(false);

    const cities = useVisibleCities();
    const selectCity = useSelectCity();

    if (cities.length <= 1) {
        return null;
    }

    const handleSelectCity = (city: typeof cities[0]) => {
        selectCity(city);
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <Tooltip>
                <TooltipTrigger render={
                    <DialogTrigger render={
                        <Button
                            variant={variant}
                            size="icon"
                            aria-label={t('map.controls.switchCity')}
                            className={cn("h-11 w-11 shrink-0", className)}
                            data-testid="map-city-switcher-btn"
                        >
                            <Earth size={20} strokeWidth={1.5} />
                        </Button>
                    } />
                } />
                <TooltipContent side="bottom" sideOffset={8}>
                    <p className="type-note">{t('map.controls.switchCity')}</p>
                </TooltipContent>
            </Tooltip>
            <DialogContent size="sm">
                <DialogHeader>
                    <DialogTitle className="type-title">{t('map.controls.switchCity')}</DialogTitle>
                    <p className="type-row text-muted-foreground/80">{t('map.regions.title')}</p>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] pr-4 -mr-4">
                    <CitySelectionList 
                        cities={cities}
                        selectedCitySlug={selectedCity || ''}
                        onSelect={handleSelectCity}
                    />
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};
