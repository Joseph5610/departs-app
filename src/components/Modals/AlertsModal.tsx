import { useState, useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Search as SearchIcon,
    X,
    AlertTriangle as AlertIcon,
    CheckCircle2,
} from 'lucide-react';
import { useUiStore } from '@/state/uiStore';
import { useAlerts } from '@/hooks/data/useAlerts';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GroupedVirtuoso } from 'react-virtuoso';
import { CondensedAlertItem } from '@/components/Alerts/CondensedAlertItem';
import { cn } from 'cn';
import { ROUTE_TYPE_ICONS } from '@/components/routeTypeIcons';
import { alertSections, type AlertFilterMode } from '@/domain/alerts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Empty,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
    EmptyDescription,
} from '@/components/ui/empty';

const ModeIcon = ({ mode, className }: { mode: string; className?: string }) => {
    const Icon = ROUTE_TYPE_ICONS[mode as keyof typeof ROUTE_TYPE_ICONS] ?? AlertIcon;
    return <Icon className={className} size={16} strokeWidth={2} />;
};

/** All of the city's alerts, grouped by mode, filterable by type and searchable. */
export const AlertsModal = memo(() => {
    const { t } = useTranslation();

    const isAlertsOpen = useUiStore(s => s.isAlertsOpen);
    const focusedAlertGuid = useUiStore(s => s.focusedAlertGuid);
    const { setIsAlertsOpen } = useUiStore(s => s.actions);

    const [filterMode, setFilterMode] = useState<AlertFilterMode>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const [prevFocusedGuid, setPrevFocusedGuid] = useState(focusedAlertGuid);
    if (focusedAlertGuid !== prevFocusedGuid) {
        setPrevFocusedGuid(focusedAlertGuid);
        if (focusedAlertGuid) {
            setFilterMode('all');
            setSearchQuery('');
        }
    }

    const { alerts, isLoading: loadingRSS, hasAlerts } = useAlerts();

    const sections = useMemo(() => alertSections(alerts ?? [], filterMode, searchQuery), [alerts, filterMode, searchQuery]);

    const groupCounts = useMemo(() => sections.map(s => s.items.length), [sections]);
    const groupModes = useMemo(() => sections.map(s => s.mode), [sections]);
    const flatItems = useMemo(() => sections.flatMap(s => s.items), [sections]);
    const focusedIndex = useMemo(
        () => focusedAlertGuid ? flatItems.findIndex(item => item.guid === focusedAlertGuid) : -1,
        [flatItems, focusedAlertGuid]
    );

    const itemGroupMeta = useMemo(() => {
        const meta: { itemIndexInGroup: number; countInGroup: number }[] = [];
        groupCounts.forEach((count) => {
            for (let i = 0; i < count; i++) {
                meta.push({
                    itemIndexInGroup: i,
                    countInGroup: count,
                });
            }
        });
        return meta;
    }, [groupCounts]);

    return (
        <Dialog open={isAlertsOpen && hasAlerts} onOpenChange={setIsAlertsOpen}>
            <DialogContent aria-describedby={undefined} variant="default" className="max-w-xl flex flex-col h-[calc(85dvh)] p-0 overflow-hidden gap-0" data-testid="alerts-modal-content">
                <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
                    <DialogTitle>
                        {t('alerts.title')}
                    </DialogTitle>
                </DialogHeader>
                
                <div className="flex-1 flex flex-col min-h-0">
                    <div className="pt-1 pb-3 px-6 shrink-0 border-b border-border/50 bg-transparent">
                        <div className="flex flex-col gap-3">
                            <Tabs value={filterMode} onValueChange={(v) => setFilterMode(v as AlertFilterMode)}>
                                <TabsList variant="pill" className="w-full grid grid-cols-3">
                                    <TabsTrigger value="all" className="cursor-pointer">{t('alerts.all')}</TabsTrigger>
                                    <TabsTrigger value="incident" className="cursor-pointer">{t('alerts.incidents')}</TabsTrigger>
                                    <TabsTrigger value="exclusion" className="cursor-pointer">{t('alerts.exclusions')}</TabsTrigger>
                                </TabsList>
                            </Tabs>

                            <div className="relative group">
                                <Input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={t('search.placeholder')}
                                    className="h-10 pl-10 pr-10 text-sm rounded-xl border border-border/80 bg-card focus-visible:ring-primary/40 transition-colors"
                                />
                                <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={16} strokeWidth={1.5} />
                                {searchQuery && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
                                    >
                                        <X size={16} strokeWidth={1.5} />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 px-6 py-2">
                        {sections.length === 0 && !loadingRSS ? (
                            <div className="flex flex-1 items-center justify-center py-12 h-full">
                                <Empty className="animate-in fade-in zoom-in-95 duration-300">
                                    <EmptyHeader>
                                        <EmptyMedia
                                            variant="icon"
                                            className="size-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.12)] [&_svg:not([class*='size-'])]:size-7"
                                        >
                                            <CheckCircle2 strokeWidth={1.5} />
                                        </EmptyMedia>
                                        <EmptyTitle className="text-base font-bold text-foreground/90">
                                            {t('alerts.noAlerts')}
                                        </EmptyTitle>
                                        <EmptyDescription className="text-sm max-w-64">
                                            {searchQuery.trim()
                                                ? t('alerts.noAlertsSearchDescription')
                                                : t('alerts.noAlertsDescription')
                                            }
                                        </EmptyDescription>
                                    </EmptyHeader>
                                </Empty>
                            </div>
                        ) : (
                            <GroupedVirtuoso
                                style={{ height: '100%' }}
                                groupCounts={groupCounts}
                                initialTopMostItemIndex={focusedIndex >= 0 ? { index: focusedIndex, align: 'start' } : 0}
                                groupContent={(index) => {
                                    const mode = groupModes[index];
                                    const count = groupCounts[index];
                                    return (
                                        <div className="sticky top-0 z-10 flex items-center justify-between px-1 py-2 bg-background/95 backdrop-blur-md">
                                            <div className="flex items-center gap-2">
                                                <ModeIcon mode={mode} className="text-primary" />
                                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                                    {t(`transportModes.${mode}`)}
                                                </h3>
                                            </div>
                                            <Badge variant="outline" className="text-[10px] font-mono font-bold bg-foreground/5 border-border/40 text-muted-foreground px-2 py-0.5 rounded-full">
                                                {count}
                                            </Badge>
                                        </div>
                                    );
                                }}
                                itemContent={(index) => {
                                    const item = flatItems[index];
                                    const { itemIndexInGroup, countInGroup } = itemGroupMeta[index] || { itemIndexInGroup: 0, countInGroup: 1 };
                                    const isFirst = itemIndexInGroup === 0;
                                    const isLast = itemIndexInGroup === countInGroup - 1;

                                    return (
                                        <div
                                            className={cn(
                                                "bg-card/70 backdrop-blur-xs border-x border-border/40 transition-colors overflow-hidden",
                                                isFirst && "rounded-t-2xl border-t mt-1.5",
                                                isLast && "rounded-b-2xl border-b mb-3 shadow-xs",
                                                !isLast && "border-b border-border/40"
                                            )}
                                        >
                                            <CondensedAlertItem key={item.guid ?? `${item.title}-${index}`} item={item} defaultExpanded={index === focusedIndex} />
                                        </div>
                                    );
                                }}
                            />
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
});

AlertsModal.displayName = 'AlertsModal';

