import { describe, expect, it } from 'vitest';
import { parseStopRequest } from './stopIds';

describe('parseStopRequest', () => {
    it('reads the station a value names and its platforms', () => {
        expect(parseStopRequest('U1146:U1146Z22,U1146Z23')).toEqual({ station: 'U1146', parts: ['U1146Z22', 'U1146Z23'] });
    });

    it('reads a station with no platforms as the whole station', () => {
        expect(parseStopRequest('U1146:')).toEqual({ station: 'U1146', parts: ['U1146'] });
    });

    // Older clients and links name stops on their own; the Worker looks those up.
    it('reads a value without a station as the stops it names', () => {
        expect(parseStopRequest('U1Z1P,U1Z1')).toEqual({ station: null, parts: ['U1Z1P', 'U1Z1'] });
    });
});
