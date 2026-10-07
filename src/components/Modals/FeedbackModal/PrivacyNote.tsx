import { useTranslation } from 'react-i18next';
import { paths } from '@/lib/routes';

/** How long a report is kept, with the privacy policy a tab away; shown wherever a report is sent. */
export const PrivacyNote = () => {
    const { t } = useTranslation();
    return (
        <p className="text-[11px] text-muted-foreground text-center px-2">
            {t('feedback.privacyNote')}{' '}
            <a href={paths.privacy} target="_blank" rel="noopener" className="underline underline-offset-2">{t('legal.links.privacy')}</a>
        </p>
    );
};
