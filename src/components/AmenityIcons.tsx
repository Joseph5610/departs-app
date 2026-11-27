import { useTranslation } from 'react-i18next';
import { Accessibility, Snowflake, Zap } from 'lucide-react';
import { cn } from '@/lib/cn';
import { IconTooltip } from '@/components/IconTooltip';

const SIZES = {
    sm: { gap: 'gap-2', icon: 'size-3.75' },
    /** Scales with the surrounding text, for the full-screen board. */
    fluid: { gap: 'gap-[0.75em]', icon: 'size-[1.1em]' },
} as const;

interface AmenityIconsProps {
    wheelchairAccessible?: boolean | null;
    airConditioned?: boolean | null;
    usbChargers?: boolean | null;
    size?: keyof typeof SIZES;
}

/** A vehicle's amenities as quiet icons with the app's tooltips; nothing when it has none. */
export const AmenityIcons = ({ wheelchairAccessible, airConditioned, usbChargers, size = 'sm' }: AmenityIconsProps) => {
    const { t } = useTranslation();
    if (!wheelchairAccessible && !airConditioned && !usbChargers) return null;
    const { gap, icon } = SIZES[size];
    return (
        <span className={cn("flex items-center text-muted-foreground", gap)}>
            {wheelchairAccessible && (
                <IconTooltip label={t('amenities.wheelchairAccessible')} className="opacity-70">
                    <Accessibility className={icon} strokeWidth={1.5} aria-hidden="true" />
                </IconTooltip>
            )}
            {airConditioned && (
                <IconTooltip label={t('amenities.airConditioned')} className="opacity-70">
                    <Snowflake className={icon} strokeWidth={1.5} aria-hidden="true" />
                </IconTooltip>
            )}
            {usbChargers && (
                <IconTooltip label={t('amenities.usbChargers')} className="opacity-70">
                    <Zap className={icon} strokeWidth={1.5} aria-hidden="true" />
                </IconTooltip>
            )}
        </span>
    );
};
