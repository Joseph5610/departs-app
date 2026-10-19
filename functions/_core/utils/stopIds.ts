/** The ids one requested `stopId` value names: a single stop, or a comma-joined list read as one stop. */
export const stopIdParts = (stopId: string): string[] => stopId.split(',').map(id => id.trim()).filter(Boolean);
