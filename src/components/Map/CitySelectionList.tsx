import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { cn } from 'cn';
import { Badge } from '@/components/ui/badge';
import type { City } from '../../types/transit';
import { groupCitiesByCountry } from '../../utils/viewerCountry';

interface CitySelectionListProps {
    cities: City[];
    selectedCitySlug: string;
    onSelect: (city: City) => void;
}

export const CitySelectionList: React.FC<CitySelectionListProps> = ({
    cities,
    selectedCitySlug,
    onSelect,
}) => {
    const { t, i18n } = useTranslation();
    const groups = useMemo(() => groupCitiesByCountry(cities), [cities]);
    const countryNames = useMemo(() => {
        try {
            return new Intl.DisplayNames([i18n.resolvedLanguage || i18n.language], { type: 'region' });
        } catch {
            return null;
        }
    }, [i18n.resolvedLanguage, i18n.language]);

    if (cities.length <= 1) {
        return null;
    }

    const renderCity = (city: City) => {
        const isSelected = selectedCitySlug === city.slug;
        const subtitle = t(`map.regions.${city.slug}`, { defaultValue: '' });

        return (
            <button
                key={city.slug}
                onClick={() => onSelect(city)}
                aria-pressed={isSelected}
                className={cn(
                    "group relative w-full h-20 flex items-center justify-start gap-4 p-4 rounded-2xl border transition-[border-color,box-shadow,background-color] duration-300 outline-none overflow-hidden focus-visible:ring-2 focus-visible:ring-primary/60",
                    isSelected
                        ? "border-primary/60 bg-card ring-1 ring-inset ring-primary/25 shadow-md dark:bg-muted/30"
                        : "border-border/60 bg-card hover:border-border hover:bg-muted/40 dark:bg-muted/30 dark:hover:bg-muted/50"
                )}
            >
                <div
                    className={cn(
                        "absolute inset-y-0 right-0 w-1/2 pointer-events-none bg-linear-to-l to-transparent transition-opacity duration-500",
                        isSelected ? "from-primary/20 opacity-100" : "from-primary/10 opacity-0 group-hover:opacity-100"
                    )}
                />
                <div
                    aria-hidden
                    className={cn(
                        "absolute right-1 top-1.5 -bottom-1 w-3/5 origin-bottom-right pointer-events-none bg-current transition-[opacity,transform,color] duration-500",
                        isSelected
                            ? "text-primary opacity-100 scale-105"
                            : "text-foreground opacity-30 group-hover:text-primary group-hover:opacity-70 group-hover:scale-105"
                    )}
                    style={{
                        maskImage: `url(/cities/${city.slug}-line.webp)`,
                        WebkitMaskImage: `url(/cities/${city.slug}-line.webp)`,
                        maskSize: 'contain',
                        WebkitMaskSize: 'contain',
                        maskRepeat: 'no-repeat',
                        WebkitMaskRepeat: 'no-repeat',
                        maskPosition: 'right bottom',
                        WebkitMaskPosition: 'right bottom',
                    }}
                />

                {/* Checkbox Layer */}
                <div className={cn(
                    "relative z-10 flex items-center justify-center w-6 h-6 rounded-full border-2 transition-[border-color,background-color,color] duration-300 shrink-0",
                    isSelected 
                        ? "border-primary bg-primary text-primary-foreground shadow-sm" 
                        : "border-border bg-background/60 text-transparent group-hover:border-muted-foreground/50"
                )}>
                    <Check size={14} strokeWidth={3} className={cn("transition-transform duration-300", isSelected ? "scale-100" : "scale-50 opacity-0")} />
                </div>

                {/* Text Layer */}
                <div className="relative flex flex-col items-start z-10">
                    <div className="flex items-center gap-2">
                        <span className={cn(
                            "text-xl font-bold tracking-tight text-foreground"
                        )}>
                            {city.name}
                        </span>
                        {city.isBeta && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 uppercase font-bold tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-500 border-amber-500/30">
                                {t('common.beta')}
                            </Badge>
                        )}
                    </div>
                    {subtitle && (
                        <span className="text-sm text-muted-foreground font-medium">
                            {subtitle}
                        </span>
                    )}
                </div>
            </button>
        );
    };

    return (
        <div className="flex flex-col gap-2.5 p-2 -mx-2">
            {groups.length > 1
                ? groups.map((group) => (
                    <section key={group.country} className="flex flex-col gap-2.5">
                        <div className="text-[10px] text-muted-foreground/50 font-bold uppercase tracking-widest px-1">
                            {countryNames?.of(group.country) ?? group.country}
                        </div>
                        {group.cities.map(renderCity)}
                    </section>
                ))
                : cities.map(renderCity)}
        </div>
    );
};

CitySelectionList.displayName = 'CitySelectionList';
