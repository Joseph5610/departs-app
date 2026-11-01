import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { SectionHeading } from '@/components/SectionHeading';
import { Badge } from '@/components/ui/badge';
import type { CityFacts } from '@shared/cities';
import { groupCitiesByCountry } from '@/domain/cities';

interface CitySelectionListProps {
    cities: CityFacts[];
    selectedCitySlug: string;
    onSelect: (city: CityFacts) => void;
    /** `compact` trims the cards for screens where the list shares space (the welcome modal). */
    size?: 'default' | 'compact';
}

export const CitySelectionList = ({
    cities,
    selectedCitySlug,
    onSelect,
    size = 'default',
}: CitySelectionListProps) => {
    const compact = size === 'compact';
    const { t, i18n } = useTranslation();
    const groups = useMemo(() => groupCitiesByCountry(cities), [cities]);
    const countryNames = useMemo(() => {
        try {
            return new Intl.DisplayNames(i18n.resolvedLanguage, { type: 'region' });
        } catch {
            return null;
        }
    }, [i18n.resolvedLanguage]);

    if (cities.length <= 1) {
        return null;
    }

    const renderCity = (city: CityFacts) => {
        const isSelected = selectedCitySlug === city.slug;
        const subtitle = t(`map.regions.${city.slug}`, { defaultValue: '' });

        return (
            <Button
                key={city.slug}
                onClick={() => onSelect(city)}
                aria-pressed={isSelected}
                variant={isSelected ? 'selected' : 'pill'}
                className={cn(
                    "group relative h-auto w-full justify-start overflow-hidden rounded-surface whitespace-normal text-foreground focus-visible:ring-2 focus-visible:ring-primary/60",
                    compact ? "h-17 gap-3 px-4 py-3" : "h-20 gap-4 p-4",
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
                            ? "text-tint-mint opacity-100 scale-105"
                            : "text-foreground opacity-30 group-hover:text-tint-mint group-hover:opacity-70 group-hover:scale-105"
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

                <div className={cn(
                    "relative z-10 flex items-center justify-center w-6 h-6 rounded-full border-2 transition-[border-color,background-color,color] duration-300 shrink-0",
                    isSelected 
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-label-3 text-transparent"
                )}>
                    <Check size={14} strokeWidth={3} className={cn("transition-transform duration-300", isSelected ? "scale-100" : "scale-50 opacity-0")} />
                </div>

                <div className="relative flex flex-col items-start z-10">
                    <div className="flex items-center gap-2">
                        <span className={cn(
                            "font-semibold tracking-tight text-foreground",
                            compact ? "type-section" : "type-title"
                        )}>
                            {city.name}
                        </span>
                        {city.isBeta && (
                            <Badge variant="beta">
                                {t('common.beta')}
                            </Badge>
                        )}
                    </div>
                    {subtitle && (
                        <span className={cn("text-muted-foreground", compact ? "type-row" : "type-row")}>
                            {subtitle}
                        </span>
                    )}
                </div>
            </Button>
        );
    };

    return (
        <div className={cn("flex flex-col", compact ? "gap-2" : "gap-2.5 p-2 -mx-2")}>
            {groups.length > 1
                ? groups.map((group) => (
                    <section key={group.country} className={cn("flex flex-col", compact ? "gap-2" : "gap-2.5")}>
                        <SectionHeading>{countryNames?.of(group.country) ?? group.country}</SectionHeading>
                        {group.cities.map(renderCity)}
                    </section>
                ))
                : cities.map(renderCity)}
        </div>
    );
};
