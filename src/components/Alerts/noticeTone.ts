import type { Infotext } from '@/types';

/** The alert icon's colour for a notice of `priority`. */
export const noticeIconTone = (priority: Infotext['priority']) =>
    priority === 'high' ? "text-destructive!" : priority === 'normal' ? "text-tint-amber!" : "text-muted-foreground";
