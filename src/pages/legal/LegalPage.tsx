import { useTranslation } from 'react-i18next';
import { SITE } from '@/config/site';
import { formatDate } from '@/domain/time';
import { LegalLayout, LegalSection } from './LegalLayout';

interface LegalTextSection {
    heading: string;
    paragraphs: string[];
}

interface LegalPageProps {
    doc: 'privacy' | 'terms';
}

/** The privacy policy or terms of use. */
const LegalPage = ({ doc }: LegalPageProps) => {
    const { t, i18n } = useTranslation();
    const vars = { email: SITE.CONTACT_EMAIL, operator: SITE.OPERATOR };
    const sections = t(`legal.${doc}.sections`, { returnObjects: true, ...vars }) as LegalTextSection[];

    return (
        <LegalLayout
            doc={doc}
            title={t(`legal.${doc}.title`)}
            subtitle={t('legal.updated', { date: formatDate(SITE.LEGAL_UPDATED, i18n.resolvedLanguage) })}
        >
            <p className="leading-relaxed">{t(`legal.${doc}.intro`)}</p>

            {doc === 'privacy' && (
                <LegalSection heading={t('legal.privacy.whoHeading')}>
                    {SITE.OPERATOR && <p className="leading-relaxed text-muted-foreground">{t('legal.privacy.operator', vars)}</p>}
                    <p className="leading-relaxed text-muted-foreground">{t('legal.privacy.contact', vars)}</p>
                </LegalSection>
            )}

            {sections.map(section => (
                <LegalSection key={section.heading} heading={section.heading}>
                    {section.paragraphs.map(paragraph => (
                        <p key={paragraph} className="leading-relaxed text-muted-foreground">{paragraph}</p>
                    ))}
                </LegalSection>
            ))}
        </LegalLayout>
    );
};

export default LegalPage;
