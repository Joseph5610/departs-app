import { useTranslation } from 'react-i18next';
import { BellRing } from 'lucide-react';
import { ToggleSection } from '@/components/Modals/SettingsModal/SettingsControls';
import { useDisruptionPushToggle } from '@/hooks/features/useDisruptionPush';
import { usePreferencesStore } from '@/state/preferencesStore';

/** The switch for pushes of new disruptions on pinned lines; shared by the settings and the alerts view. */
export const DisruptionPushToggle = ({ className }: { className?: string }) => {
    const { t } = useTranslation();
    const isOn = usePreferencesStore(s => s.disruptionPush);
    const toggle = useDisruptionPushToggle();

    return (
        <ToggleSection
            title={t('disruptionPush.settingTitle')}
            description={t('disruptionPush.settingDescription')}
            icon={BellRing}
            isChecked={isOn}
            onToggle={(on) => void toggle(on)}
            className={className}
        />
    );
};
