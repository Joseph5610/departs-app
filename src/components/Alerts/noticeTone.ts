import type { Infotext } from '@/types';

/** The alert icon's colour for a notice of `priority`. */
export const noticeIconTone = (priority: Infotext['priority']) =>
    priority === 'high' ? "text-destructive!" : priority === 'normal' ? "text-tint-amber!" : "text-muted-foreground";

/** The background, border and text of a banner showing a notice of `priority`, such as the board's footer. */
export const noticeBannerTone = (priority: Infotext['priority']) =>
    priority === 'high' ? "bg-destructive/15 border-destructive/40 text-foreground"
        : priority === 'normal' ? "bg-tint-amber/10 border-tint-amber/30 text-foreground"
        : "bg-muted/40 border-border text-muted-foreground";
