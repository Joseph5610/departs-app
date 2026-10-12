const largestSeen = { top: 0, bottom: 0 };

/**
 * A safe-area inset (status bar, notch, home indicator) in CSS pixels, measured with a throwaway element.
 * The largest seen so far, since iOS reports 0 while an installed app launches or resumes.
 */
export const readSafeArea = (side: 'top' | 'bottom'): number => {
    const probe = document.createElement('div');
    probe.style.cssText = `position:fixed;top:0;left:0;width:0;height:env(safe-area-inset-${side},0px);visibility:hidden;pointer-events:none`;
    document.body.appendChild(probe);
    largestSeen[side] = Math.max(largestSeen[side], probe.getBoundingClientRect().height);
    probe.remove();
    return largestSeen[side];
};
