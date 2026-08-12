import React from 'react';
import { useTranslation } from 'react-i18next';
import { Ticket, MapPin, CreditCard, CheckCircle2, Building2, Landmark, HelpCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Item, ItemGroup, ItemMedia, ItemContent, ItemTitle } from '@/components/ui/item';
import type { PointOfSale, PointOfSaleType } from '../../types/pointsOfSale';

interface PointOfSaleDetailProps {
    pos: PointOfSale;
}

const TYPE_ICONS: Record<PointOfSaleType, React.ElementType> = {
    ticketMachine: Ticket,
    ticketOfficeMetro: Building2,
    informationCenter: Landmark,
    trainStation: Building2,
    carrierOffice: Building2,
    chipCardDispense: CreditCard,
};

const DAY_NAMES_CS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
const DAY_NAMES_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatDayRange(from: number, to: number, lang: string): string {
    const names = lang === 'cs' ? DAY_NAMES_CS : DAY_NAMES_EN;
    if (from === 0 && to === 6) return lang === 'cs' ? 'Po–Ne' : 'Mon–Sun';
    if (from === 0 && to === 4) return lang === 'cs' ? 'Po–Pá' : 'Mon–Fri';
    if (from === 5 && to === 6) return lang === 'cs' ? 'So–Ne' : 'Sat–Sun';
    if (from === to) return names[from] || '';
    return `${names[from]}–${names[to]}`;
}

export const PointOfSaleDetail: React.FC<PointOfSaleDetailProps> = ({ pos }) => {
    const { t, i18n } = useTranslation();
    const lang = i18n.language.startsWith('cs') ? 'cs' : 'en';

    const Icon = TYPE_ICONS[pos.type] || HelpCircle;

    return (
        <div className="flex flex-col gap-3 px-0 pt-3 pb-4">
            {/* Hero Card inspired by VehicleHero */}
            <Card 
                size="none" 
                className="border border-emerald-500/30 ring-0 shadow-xl relative flex flex-col transition-colors overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent"
            >
                <div className="flex flex-col p-4 gap-3">
                    <div className="flex items-center justify-between">
                        <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-[11px] font-bold tracking-wide px-2.5 py-0.5 rounded-lg">
                            <Icon size={13} className="mr-1.5 shrink-0 inline" />
                            {t(`pos.types.${pos.type}`, pos.type)}
                        </Badge>
                    </div>

                    <h2 className="text-xl font-bold text-foreground leading-tight whitespace-normal break-words">
                        {pos.name}
                    </h2>

                    {pos.address && (
                        <div className="flex items-start gap-1.5 text-xs text-muted-foreground leading-relaxed pt-2 border-t border-border/40">
                            <MapPin size={15} className="shrink-0 mt-0.5 text-emerald-500" />
                            <span className="whitespace-normal break-words font-medium">{pos.address}</span>
                        </div>
                    )}
                </div>
            </Card>

            {/* Opening Hours Section */}
            {pos.openingHours && pos.openingHours.length > 0 && (
                <Card variant="subtle" size="sm" className="p-3.5 flex flex-col gap-2">
                    <CardHeader className="p-0 pb-1">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            {t('pos.openingHours')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 flex flex-col gap-1.5">
                        {pos.openingHours.map((oh) => (
                            <div key={`${oh.from}-${oh.to}-${oh.hours}`} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-b-0 last:py-0">
                                <span className="font-semibold text-foreground">{formatDayRange(oh.from, oh.to, lang)}</span>
                                <span className="font-mono text-[12px] text-muted-foreground">{oh.hours}</span>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Payment Methods Section */}
            {pos.payMethods && pos.payMethods.length > 0 && (
                <Card variant="subtle" size="sm" className="p-3.5 flex flex-col gap-2.5">
                    <CardHeader className="p-0">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            {t('pos.payMethodsTitle')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 flex flex-wrap gap-2">
                        {pos.payMethods.map((pm) => (
                            <Badge key={pm} variant="secondary" className="px-3 py-1.5 gap-2 text-xs font-medium rounded-xl border border-border/50 bg-secondary/60">
                                <CreditCard size={13} className="text-emerald-500 shrink-0" />
                                <span>{t(`pos.payMethods.${pm}`, pm)}</span>
                            </Badge>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Provided Services Section */}
            {pos.services && pos.services.length > 0 && (
                <Card variant="subtle" size="sm" className="p-3.5 flex flex-col gap-2.5">
                    <CardHeader className="p-0">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            {t('pos.servicesTitle')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ItemGroup>
                            {pos.services.map((srv) => (
                                <Item key={srv} size="none" variant="default" className="py-0.5">
                                    <ItemMedia variant="icon" className="text-emerald-500 shrink-0">
                                        <CheckCircle2 size={16} strokeWidth={2} />
                                    </ItemMedia>
                                    <ItemContent>
                                        <ItemTitle className="text-xs font-medium text-foreground leading-snug">
                                            {t(`pos.services.${srv}`, srv)}
                                        </ItemTitle>
                                    </ItemContent>
                                </Item>
                            ))}
                        </ItemGroup>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};
