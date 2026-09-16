import type { AppVehicleState } from '../../../_core/types';

export const DUK_STATE_MAPPING: Record<number, AppVehicleState> = {
    255: 'off_track',            // Vypnuto
    0: 'on_track',               // V jízdě
    1: 'at_stop',                // V zastávce/stanici
    2: 'before_track',           // Čeká před jízdou
    3: 'before_track'            // V jízdě na první zastávku
};
