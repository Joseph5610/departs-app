import React from 'react';
import { useTranslation } from 'react-i18next';
import { MoonStar } from 'lucide-react';
import { Box, Stack, Surface } from '@/components/ui/layout';

/**
 * MetroNightMessage
 *
 * Displays a friendly message when a metro station is visited during night hours
 * and no departures are scheduled.
 */
export const MetroNightMessage: React.FC = () => {
    const { t } = useTranslation();

    return (
        <Surface variant="tinted" padding="xl" className="items-center text-center flex flex-col gap-4 border-white/10!">
            <Box className="p-4 bg-indigo-500/10 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.1)]">
                <MoonStar size={32} className="text-indigo-400" />
            </Box>
            <Stack gap={2}>
                <h3 className="text-foreground font-bold text-lg">{t('map.departures.metroNight.title')}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                    {t('map.departures.metroNight.description')}
                </p>
            </Stack>
        </Surface>
    );
};

MetroNightMessage.displayName = 'MetroNightMessage';
