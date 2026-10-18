import { DEFAULT_LINE_RULES, type LineRules } from '@/config/cities';

/** A city's line conventions, with the generic defaults for anything it doesn't define. */
export const lineRulesOf = (rules: Partial<LineRules> | undefined): LineRules => ({ ...DEFAULT_LINE_RULES, ...rules });
