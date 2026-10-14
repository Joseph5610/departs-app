import type { EnrichmentChannelAdapter } from '@/types';

interface EnrichmentSources {
    enrichmentChannel?: EnrichmentChannelAdapter;
    estimatesDelay?: boolean;
}

/** The city's push channel to connect, or null when it has none or it is switched off. */
export const pushChannelOf = ({ enrichmentChannel }: EnrichmentSources): EnrichmentChannelAdapter | null =>
    enrichmentChannel && !enrichmentChannel.isDisabled ? enrichmentChannel : null;

/** Whether the city's delays come from enrichment (push channel or the app's own estimate) rather than the fetched data. */
export const hasEnrichment = (sources: EnrichmentSources): boolean =>
    !!pushChannelOf(sources) || !!sources.estimatesDelay;
