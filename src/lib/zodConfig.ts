import { config } from 'zod/mini';

// Skips Zod's `Function('')` feature probe, which the CSP (no 'unsafe-eval') reports as a violation on every load.
// Import this before any schema is parsed; `zod` and `zod/mini` share this setting.
config({ jitless: true });
