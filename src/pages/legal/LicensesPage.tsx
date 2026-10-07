import { Trans, useTranslation } from 'react-i18next';
import { Database, GitBranch, Package } from 'lucide-react';
import { usePreferencesStore } from '@/state/preferencesStore';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ItemGroup, Item, ItemMedia, ItemContent, ItemTitle, ItemDescription, ItemActions } from '@/components/ui/item';
import { FRONTEND_CITIES_CONFIG } from '@/config/cities';
import { DATA_LICENSE_URLS, PROCESSED_DATA_URL, SHARED_DATA_ATTRIBUTIONS, type DataAttribution } from '@/config/attributions';
import { EXTERNAL_URLS } from '@/config/constants';
import { SITE } from '@/config/site';
import { isCityVisible } from '@/domain/cities';
import { LegalLayout, LegalSection } from './LegalLayout';

const attributionGroups = (unlockedCities: string[]): Array<{ labelKey: string; sources: DataAttribution[] }> => [
    ...Object.values(FRONTEND_CITIES_CONFIG)
        .filter(city => isCityVisible(city, unlockedCities))
        .map(city => ({ labelKey: `map.regions.${city.slug}`, sources: city.attributions })),
    { labelKey: 'settings.attributions.shared', sources: SHARED_DATA_ATTRIBUTIONS },
];

/** A source credited as its licence asks: creator, the linked dataset and the linked licence. */
const AttributionItem = ({ source }: { source: DataAttribution }) => {
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
                    <Badge variant="label" render={<a href={licenseUrl} target="_blank" rel="noopener noreferrer" />}>
                        {licenseLabel}
                    </Badge>
                ) : (
                    <Badge variant="label">{licenseLabel}</Badge>
                )}
            </ItemActions>
        </Item>
    );
};

interface LinkedItemProps {
    href: string;
    icon: React.ReactNode;
    title: string;
    description: string;
    badge?: string;
}

/** A row that links as a whole, so its badge stays a plain label: an anchor can't nest inside the row's own anchor. */
const LinkedItem = ({ href, icon, title, description, badge }: LinkedItemProps) => (
    <Item variant="settings" size="none" render={<a href={href} target="_blank" rel="noopener noreferrer" />}>
        <ItemMedia variant="icon" className="text-muted-foreground">{icon}</ItemMedia>
        <ItemContent>
            <ItemTitle className="text-foreground">{title}</ItemTitle>
            <ItemDescription className="text-xs line-clamp-none">{description}</ItemDescription>
        </ItemContent>
        {badge && (
            <ItemActions>
                <Badge variant="label">{badge}</Badge>
            </ItemActions>
        )}
    </Item>
);

/** Every data source the app shows, credited with its licence, grouped by city. */
const LicensesPage = () => {
    const { t } = useTranslation();
    const unlockedCities = usePreferencesStore(s => s.unlockedCities);

    return (
        <LegalLayout doc="licenses" title={t('legal.links.licenses')}>
            <p className="leading-relaxed">{t('legal.licenses.intro')}</p>
            <p className="leading-relaxed text-muted-foreground">
                <Trans
                    i18nKey="settings.attributions.notice"
                    components={{ docs: <a href={PROCESSED_DATA_URL} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2" /> }}
                />
            </p>

            {attributionGroups(unlockedCities).map(group => (
                <LegalSection key={group.labelKey} heading={t(group.labelKey)}>
                    <Card variant="subtle" size="none" className="overflow-hidden gap-0">
                        <ItemGroup className="gap-0">
                            {group.sources.map(source => <AttributionItem key={`${source.url}|${source.title}`} source={source} />)}
                        </ItemGroup>
                    </Card>
                </LegalSection>
            ))}

            <LegalSection heading={t('legal.licenses.softwareHeading')}>
                <Card variant="subtle" size="none" className="overflow-hidden gap-0">
                    <ItemGroup className="gap-0">
                        <LinkedItem
                            href={EXTERNAL_URLS.SOURCE_REPO}
                            icon={<GitBranch size={18} strokeWidth={2} />}
                            title={t('legal.licenses.sourceTitle')}
                            description={t('legal.licenses.sourceDescription')}
                            badge="MIT"
                        />
                        <LinkedItem
                            href={`/${SITE.THIRD_PARTY_LICENSES_FILE}`}
                            icon={<Package size={18} strokeWidth={2} />}
                            title={t('legal.licenses.librariesTitle')}
                            description={t('legal.licenses.librariesDescription')}
                        />
                    </ItemGroup>
                </Card>
            </LegalSection>
        </LegalLayout>
    );
};

export default LicensesPage;
