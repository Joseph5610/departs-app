/** Where a network has stops (departs-data `coverage.json`): stop counts per `x|y` grid cell of `cell` degrees. */
export interface NetworkCoverage {
    cell: number;
    cells: Record<string, number>;
}
