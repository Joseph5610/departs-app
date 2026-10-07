import { useTranslation } from 'react-i18next';
import { cn } from 'cn';
import { usePreferencesStore } from '@/state/preferencesStore';
import { DELAY_TIERS, type DelayTierKey } from '@/config/transit';
import { toggled } from '@/lib/strings';
import { FilterHeading } from './SettingsControls';

interface DelayTierStyle {
    accentClass: string;
    activeBg: string;
    activeBorder: string;
    activeText: string;
}

const DELAY_TIER_STYLES: Record<DelayTierKey, DelayTierStyle> = {
    aheadOfTime: {
        accentClass: 'bg-sky-500 dark:bg-sky-400',
        activeBg: 'bg-sky-500/10 dark:bg-sky-500/20',
        activeBorder: 'border-sky-500/40 dark:border-sky-500/50',
        activeText: 'text-sky-950 dark:text-sky-300',
    },
    onTime: {
        accentClass: 'bg-emerald-600 dark:bg-emerald-400',
        activeBg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
        activeBorder: 'border-emerald-500/40 dark:border-emerald-500/50',
        activeText: 'text-emerald-950 dark:text-emerald-300',
    },
    moderate: {
        accentClass: 'bg-amber-600 dark:bg-amber-400',
        activeBg: 'bg-amber-500/10 dark:bg-amber-500/20',
        activeBorder: 'border-amber-500/40 dark:border-amber-500/50',
        activeText: 'text-amber-950 dark:text-amber-300',
    },
    high: {
        accentClass: 'bg-rose-600 dark:bg-rose-400',
        activeBg: 'bg-rose-500/10 dark:bg-rose-500/20',
        activeBorder: 'border-rose-500/40 dark:border-rose-500/50',
        activeText: 'text-rose-950 dark:text-rose-300',
    },
    severe: {
        accentClass: 'bg-purple-700 dark:bg-purple-400',
        activeBg: 'bg-purple-500/10 dark:bg-purple-950/40',
        activeBorder: 'border-purple-500/40 dark:border-purple-500/50',
        activeText: 'text-purple-950 dark:text-purple-200',
    },
};

const DelayFilterCard = ({
    label,
    isActive,
    onClick,
    accentClass,
    activeBg,
    activeBorder,
    activeText
}: DelayTierStyle & { label: string; isActive: boolean; onClick: () => void }) => (
    <button
        type="button"
        onClick={onClick}
        className={cn(
            "relative flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer text-left select-none outline-none group active:scale-[0.98]",
            isActive
                ? cn("shadow-2xs", activeBg, activeBorder, activeText)
                : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
        )}
    >
        <div
            className={cn(
                "w-1 h-5 rounded-full transition-all shrink-0",
                accentClass,
                isActive ? "opacity-100 scale-100" : "opacity-30 group-hover:opacity-60"
            )}
        />
        <span className="text-xs font-semibold tracking-tight truncate">
            {label}
        </span>
    </button>
);

/** Which delay tiers the map shows; an empty filter shows them all. */
export const DelayFilter = () => {
    const { t } = useTranslation();
    const delayFilter = usePreferencesStore(s => s.delayFilter);
    const { setDelayFilter } = usePreferencesStore(s => s.actions);

    return (
        <div className="flex flex-col gap-3 border-t border-border/40 pt-4">
            <div className="flex items-center justify-between">
                <FilterHeading>{t('settings.colorVehiclesByDelay.filterTitle')}</FilterHeading>
                {delayFilter.length > 0 && (
                    <button
                        onClick={() => setDelayFilter([])}
                        className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                    >
                        {t('common.all')}
                    </button>
                )}
            </div>

            <div className="grid grid-cols-2 gap-2">
                {DELAY_TIERS.map(({ key }) => (
                    <DelayFilterCard
                        key={key}
                        label={t(`settings.colorVehiclesByDelay.${key}`)}
                        isActive={delayFilter.length === 0 || delayFilter.includes(key)}
                        onClick={() => setDelayFilter(toggled(delayFilter, key))}
                        {...DELAY_TIER_STYLES[key]}
                    />
                ))}
            </div>
        </div>
    );
};
