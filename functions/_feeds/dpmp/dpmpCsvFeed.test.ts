import { describe, expect, it } from 'vitest';
import { parseDpmpCsv } from './dpmpCsvFeed';

const HEADER = 'ROUTE_NUMBER;PLANNED_START;DIRECTION;BUS_STOP_ORDER_NUM;BUS_STOP_NAME_1;BUS_STOP_NUM_1;BUS_STOP_SUB_NUM_1;BUS_STOP_NAME_2;BUS_STOP_NUM_2;BUS_STOP_SUB_NUM_2;PLANNED_ROAD;REAL_ROAD;LATITUDE;LONGITUDE;VARIATION;VEHICLE_NUMBER;DATE_TIME';
const row = (variation: number) => `N1;23:40;P;20;Volgogradská;188;1;Nám.Kráľ.pokoja;189;1;400;120;49.0042;21.2210;${variation};386;2026-10-11 23:59:04`;

// Night runs past midnight sometimes report hours of deviation; that must not become the trip's delay.
describe('parseDpmpCsv', () => {
    it('keeps a plausible variation and drops one hours off', () => {
        const [late, ahead, junk] = parseDpmpCsv([HEADER, row(-270), row(60), row(20851)].join('\n'));
        expect(late.variation).toBe(-270);
        expect(ahead.variation).toBe(60);
        expect(junk.variation).toBeNull();
        expect(junk.vehicleNumber).toBe('386');
    });
});
