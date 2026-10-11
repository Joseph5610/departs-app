import { useTranslation } from 'react-i18next';
import { Accessibility, Snowflake, Zap } from 'lucide-react';
import { IconTooltip } from '@/components/IconTooltip';

interface AmenityIconsProps {
    wheelchairAccessible?: boolean | null;
    airConditioned?: boolean | null;
    usbChargers?: boolean | null;
}

/** A vehicle's amenities as quiet icons with the app's tooltips; nothing when it has none. */
export const AmenityIcons = ({ wheelchairAccessible, airConditioned, usbChargers }: AmenityIconsProps) => {
    const { t } = useTranslation();
    if (!wheelchairAccessible && !airConditioned && !usbChargers) return null;
    return (
        <span className="flex items-center gap-2 text-muted-foreground">
            {wheelchairAccessible && (
                <IconTooltip label={t('amenities.wheelchairAccessible')} className="opacity-70">
                    <Accessibility size={15} strokeWidth={1.5} aria-hidden="true" />
                </IconTooltip>
            )}
            {airConditioned && (
                <IconTooltip label={t('amenities.airConditioned')} className="opacity-70">
                    <Snowflake size={15} strokeWidth={1.5} aria-hidden="true" />
                </IconTooltip>
            )}
            {usbChargers && (
                <IconTooltip label={t('amenities.usbChargers')} className="opacity-70">
                    <Zap size={15} strokeWidth={1.5} aria-hidden="true" />
                </IconTooltip>
            )}
        </span>
    );
};
