import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { SITE } from '@/config/site';
import { paths } from '@/lib/routes';

export type LegalDocument = 'privacy' | 'terms' | 'licenses';

const LEGAL_DOCUMENTS: LegalDocument[] = ['privacy', 'terms', 'licenses'];

interface LegalLayoutProps {
    doc: LegalDocument;
    title: string;
    /** Shown under the title, such as the date the text last changed. */
    subtitle?: string;
    children: React.ReactNode;
}

export const LegalSection = ({ heading, children }: { heading: string; children: React.ReactNode }) => (
    <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-foreground">{heading}</h2>
        {children}
    </section>
);

/** A plain readable page outside the map, with a way back and links to the other documents. */
export const LegalLayout = ({ doc, title, subtitle, children }: LegalLayoutProps) => {
    const { t } = useTranslation();

    useEffect(() => {
        document.title = `${title} — ${SITE.NAME}`;
        return () => { document.title = SITE.TITLE; };
    }, [title]);

    return (
        <div className="fixed inset-0 overflow-y-auto bg-background text-foreground">
            <main className="mx-auto flex max-w-2xl flex-col gap-8 px-5 pt-[calc(2rem+env(safe-area-inset-top,0px))] pb-[calc(3rem+env(safe-area-inset-bottom,0px))]">
                <Link href="/" className="flex w-fit items-center gap-2 text-sm font-semibold text-primary">
                    <ArrowLeft size={16} strokeWidth={2.5} />
                    {t('legal.backToMap')}
                </Link>

                <header className="flex flex-col gap-2">
                    <h1 className="text-3xl font-black tracking-tight">{title}</h1>
                    {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
                </header>

                {children}

                <footer className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-6 text-sm">
                    {LEGAL_DOCUMENTS.filter(other => other !== doc).map(other => (
                        <Link key={other} href={paths[other]} className="font-semibold text-primary">{t(`legal.links.${other}`)}</Link>
                    ))}
                    <a href={`mailto:${SITE.CONTACT_EMAIL}`} className="text-muted-foreground">{SITE.CONTACT_EMAIL}</a>
                </footer>
            </main>
        </div>
    );
};
