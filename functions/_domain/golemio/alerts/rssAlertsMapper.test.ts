import { describe, expect, it } from 'vitest';
import type { PidRssItem } from '../../../_feeds/golemio/rssExclusions';
import { mapRssExclusions, routeIdsByName } from './rssAlertsMapper';

describe('mapRssExclusions', () => {
    // RSS names lines, GTFS-RT ids them; "L4" names a train while tram 4's id is also "L4", so names must become ids.
    it('sends known line names as their route ids and unknown ones as names', () => {
        const byName = routeIdsByName({ L4: { name: '4', type: 0 }, L1264: { name: 'L4', type: 2 } });
        const item = { title: 'Výluka', lines: ['l4', '4', 'X9'] } as PidRssItem;

        expect(mapRssExclusions([item], byName)[0].lines).toEqual(['L1264', 'L4', 'X9']);
    });
});
