import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Clock, Database, Scale, MessageSquareHeart, GitBranch } from 'lucide-react';
import { version } from '../../../../package.json';
import { usePWAStore } from '../../../state/pwaStore';
import { usePreferencesStore } from '../../../state/preferencesStore';
import { useUiStore } from '../../../state/uiStore';
import { useStops } from '../../../hooks/data/useStops';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ItemGroup, Item, ItemMedia, ItemContent, ItemTitle, ItemDescription, ItemActions } from '@/components/ui/item';
import { FRONTEND_CITIES_CONFIG } from '../../../config/cities';
import { DATA_LICENSE_URLS, PROCESSED_DATA, SHARED_DATA_ATTRIBUTIONS, type DataAttribution } from '../../../config/attributions';
import { EXTERNAL_URLS, UI_TIMING_MS } from '../../../config/constants';
import { formatDateTime } from '../../../utils/dateUtils';

const attributionGroups = (unlockedCities: string[]): Array<{ labelKey: string; sources: DataAttribution[] }> => [
    ...Object.values(FRONTEND_CITIES_CONFIG)
        .filter(city => !city.isHidden || unlockedCities.includes(city.slug))
        .map(city => ({ labelKey: `map.regions.${city.slug}`, sources: city.attributions })),
    { labelKey: 'settings.attributions.shared', sources: SHARED_DATA_ATTRIBUTIONS },
];

const badgeClassName = 'text-[10px] text-muted-foreground/70 border-border/40 bg-foreground/5 uppercase font-semibold tracking-wider';

/** A source credited as its licence asks: creator, the linked dataset and the linked licence. */
const AttributionItem: React.FC<{ source: DataAttribution }> = ({ source }) => {
    const { t } = useTranslation();
    const licenseUrl = DATA_LICENSE_URLS[source.license];
    const licenseLabel = t(`settings.attributions.licenses.${source.license}`);
    return (
        <Item variant="settings" size="none">
            <ItemMedia variant="icon" className="text-muted-foreground">
                <Database size={18} strokeWidth={2} />
            </ItemMedia>
            <ItemContent>
                <ItemTitle className="text-foreground">{source.creator}</ItemTitle>
                <ItemDescription className="text-xs">
                    <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a>
                </ItemDescription>
            </ItemContent>
            <ItemActions>
                {licenseUrl ? (
                    <Badge variant="outline" className={badgeClassName} render={<a href={licenseUrl} target="_blank" rel="noopener noreferrer" />}>
                        {licenseLabel}
                    </Badge>
                ) : (
                    <Badge variant="outline" className={badgeClassName}>{licenseLabel}</Badge>
                )}
            </ItemActions>
        </Item>
    );
};

export const SettingsFooter: React.FC = () => {
    const { t, i18n } = useTranslation();

    // Preferences
    const searchHistory = usePreferencesStore(s => s.searchHistory);
    const unlockedCities = usePreferencesStore(s => s.unlockedCities);
    const { clearHistory } = usePreferencesStore(s => s.actions);
    const { setIsFeedbackOpen, setIsSettingsOpen } = useUiStore(s => s.actions);

    const { updatedAt } = useStops();
    const [isChecking, setIsChecking] = useState(false);

    // PWA
    const needRefresh = usePWAStore(s => s.needRefresh);

    // Reset checking state if update is found
    React.useEffect(() => {
        if (needRefresh && isChecking) {
            const timer = setTimeout(() => setIsChecking(false), 0);
            return () => clearTimeout(timer);
        }
    }, [needRefresh, isChecking]);

    const handleCheckUpdate = async () => {
        if (isChecking) return;

        // If already need refresh, don't show another check
        if (needRefresh) {
            return;
        }

        setIsChecking(true);

        try {
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.getRegistration();
                if (registration) {
                    await registration.update();
                    
                    // No update prompt within the wait means this version is current.
                    setTimeout(() => {
                        setIsChecking((currentChecking) => {
                            if (currentChecking) {
                                toast.success(t('settings.updates.upToDate'));
                                return false;
                            }
                            return false;
                        });
                    }, UI_TIMING_MS.UPDATE_CHECK_WAIT);
                    return;
                }
            }
        } catch (error) {
            console.error('Update check failed', error);
        }
        
        setIsChecking(false);
        toast.success(t('settings.updates.upToDate'));
    };

    return (
        <div className="flex flex-col gap-6">
            <Card variant="subtle" size="none" className="overflow-hidden gap-0">
                <ItemGroup className="gap-0">
                    {searchHistory.length > 0 && (
                        <Item
                            variant="settings"
                            size="none"
                            render={<button onClick={() => { clearHistory(); toast.success(t('settings.clearHistory.success')); }} />}
                        >
                            <ItemMedia variant="icon" className="text-destructive">
                                <Clock size={18} strokeWidth={2} />
                            </ItemMedia>
                            <ItemContent>
                                <ItemTitle className="text-foreground">{t('settings.clearHistory.button')}</ItemTitle>
                            </ItemContent>
                        </Item>
                    )}
                    <Item
                        variant="settings"
                        size="none"
                        render={<button onClick={() => { setIsSettingsOpen(false); setTimeout(() => setIsFeedbackOpen(true), UI_TIMING_MS.MODAL_SWAP_DELAY); }} />}
                    >
                        <ItemMedia variant="icon" className="text-primary">
                            <MessageSquareHeart size={18} strokeWidth={2} />
                        </ItemMedia>
                        <ItemContent>
                            <ItemTitle className="text-foreground">{t('feedback.title')}</ItemTitle>
                        </ItemContent>
                    </Item>

                    <Item
                        variant="settings"
                        size="none"
                        className={cn(isChecking && "opacity-50 pointer-events-none")}
                        render={<button onClick={handleCheckUpdate} disabled={isChecking} />}
                    >
                        <ItemMedia variant="icon" className={cn("text-muted-foreground", isChecking && "animate-spin text-primary")}>
                            <RefreshCw size={18} strokeWidth={2} />
                        </ItemMedia>
                        <ItemContent>
                            <ItemTitle className="text-foreground">
                                {isChecking ? t('settings.updates.checking') : t('settings.updates.check')}
                            </ItemTitle>
                        </ItemContent>
                        <ItemActions>
                            <Badge variant="outline" className="text-[10px] text-muted-foreground/70 border-border/40 bg-foreground/5 uppercase font-semibold tracking-wider">
                                {t('settings.versionBadge', { version })}
                            </Badge>
                        </ItemActions>
                    </Item>

                    <Item
                        variant="settings"
                        size="none"
                        render={<a href={EXTERNAL_URLS.SOURCE_REPO} target="_blank" rel="noopener noreferrer" />}
                    >
                        <ItemMedia variant="icon" className="text-muted-foreground">
                            <GitBranch size={18} strokeWidth={2} />
                        </ItemMedia>
                        <ItemContent>
                            <ItemTitle className="text-foreground">{t('settings.viewSource')}</ItemTitle>
                        </ItemContent>
                        <ItemActions>
                            <Badge variant="outline" className="text-[10px] text-muted-foreground/70 border-border/40 bg-foreground/5 uppercase font-semibold tracking-wider">
                                {t('settings.sourceBadge')}
                            </Badge>
                        </ItemActions>
                    </Item>
                </ItemGroup>
            </Card>

            <div className="flex flex-col gap-2">
                <div className="text-[10px] text-muted-foreground/50 font-bold uppercase tracking-widest px-1">
                    {t('settings.sections.attributions')}
                </div>
                {attributionGroups(unlockedCities).map(group => (
                    <div key={group.labelKey} className="flex flex-col gap-1.5">
                        <div className="text-[11px] text-muted-foreground font-semibold px-1">{t(group.labelKey)}</div>
                        <Card variant="subtle" size="none" className="overflow-hidden gap-0">
                            <ItemGroup className="gap-0">
                                {group.sources.map(source => <AttributionItem key={`${source.url}|${source.title}`} source={source} />)}
                            </ItemGroup>
                        </Card>
                    </div>
                ))}
                <Card variant="subtle" size="none" className="overflow-hidden gap-0">
                    <ItemGroup className="gap-0">
                        <Item
                            variant="settings"
                            size="none"
                            render={<a href={PROCESSED_DATA.url} target="_blank" rel="noopener noreferrer" />}
                        >
                            <ItemMedia variant="icon" className="text-muted-foreground">
                                <Scale size={18} strokeWidth={2} />
                            </ItemMedia>
                            <ItemContent>
                                <ItemTitle className="text-foreground">{t('settings.attributions.processedTitle')}</ItemTitle>
                                <ItemDescription className="text-xs line-clamp-none">{t('settings.attributions.notice')}</ItemDescription>
                            </ItemContent>
                            <ItemActions>
                                <Badge variant="outline" className={badgeClassName}>
                                    {t(`settings.attributions.licenses.${PROCESSED_DATA.license}`)}
                                </Badge>
                            </ItemActions>
                        </Item>
                    </ItemGroup>
                </Card>
            </div>

            {updatedAt && (
                <div className="text-[10px] text-muted-foreground/30 font-medium text-center pb-2 px-6">
                    {t('settings.lastStopUpdate', { date: formatDateTime(updatedAt, i18n.language) })}
                </div>
            )}
        </div>
    );
};

SettingsFooter.displayName = 'SettingsFooter';
