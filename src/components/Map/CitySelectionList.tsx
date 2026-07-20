import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AppCity } from '../../../functions/_core/types';

interface CitySelectionListProps {
    cities: AppCity[];
    selectedCitySlug: string;
    onSelect: (city: AppCity) => void;
}

export const CitySelectionList: React.FC<CitySelectionListProps> = ({
    cities,
    selectedCitySlug,
    onSelect,
}) => {
    const { t } = useTranslation();

    if (cities.length <= 1) {
        return null;
    }

    return (
        <div className="flex flex-col gap-2.5 p-2 -mx-2">
            {cities.map((city) => {
                const isSelected = selectedCitySlug === city.slug;
                const subtitle = t(`map.regions.${city.slug}`, { defaultValue: '' });

                return (
                    <button
                        key={city.slug}
                        onClick={() => onSelect(city)}
                        className={cn(
                            "group relative w-full h-20 flex items-center justify-start gap-4 p-4 rounded-2xl border transition-all duration-300 outline-none overflow-hidden bg-card dark:bg-[oklch(0.18_0.01_260)]",
                            isSelected 
                                ? "border-primary/50 shadow-[0_0_20px_rgba(16,185,129,0.1)] ring-1 ring-inset ring-primary/30"
                                : "border-border/40 hover:border-border/80 hover:shadow-md"
                        )}
                    >
                        {/* Subdued Background Wallpaper */}
                        <div 
                            className="absolute inset-0 z-0 overflow-hidden pointer-events-none rounded-2xl hidden dark:block"
                            style={{
                                maskImage: 'linear-gradient(to right, transparent 0%, transparent 35%, black 100%)',
                                WebkitMaskImage: 'linear-gradient(to right, transparent 0%, transparent 35%, black 100%)'
                            }}
                        >
                            <img 
                                src={`/cities/${city.slug}.png`} 
                                alt=""
                                className={cn(
                                    "absolute right-0 h-full w-auto object-contain mix-blend-lighten transition-all duration-500",
                                    isSelected ? "opacity-80 scale-[2]" : "opacity-30 scale-[1.8] group-hover:opacity-50 group-hover:scale-[1.9]"
                                )}
                                style={{ transformOrigin: 'right center' }}
                            />
                        </div>
                        
                        {/* Checkbox Layer */}
                        <div className={cn(
                            "relative z-10 flex items-center justify-center w-6 h-6 rounded-full border-2 transition-all duration-300 shrink-0",
                            isSelected 
                                ? "border-primary bg-primary text-primary-foreground shadow-sm" 
                                : "border-border/50 bg-muted/50 text-transparent group-hover:border-border/50"
                        )}>
                            <Check size={14} strokeWidth={3} className={cn("transition-transform duration-300", isSelected ? "scale-100" : "scale-50 opacity-0")} />
                        </div>

                        {/* Text Layer */}
                        <div className="relative flex flex-col items-start z-10">
                            <div className="flex items-center gap-2">
                                <span className={cn(
                                    "text-xl font-bold tracking-tight transition-colors",
                                    isSelected ? "text-primary" : "text-foreground"
                                )}>
                                    {city.name}
                                </span>
                                {city.isBeta && (
                                    <span className="bg-amber-500/20 text-amber-500 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">
                                        Beta
                                    </span>
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
            })}
        </div>
    );
};

CitySelectionList.displayName = 'CitySelectionList';
