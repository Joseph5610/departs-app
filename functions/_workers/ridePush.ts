/** Entry of the `departs-ride-push` Worker (`workers/ride-push/wrangler.toml`): only hosts `RideWatch` and `DisruptionWatch`, reached through Pages bindings. */
export { RideWatch } from './RideWatch';
export { DisruptionWatch } from './DisruptionWatch';

export default {
    fetch: () => new Response('Not found', { status: 404 }),
} satisfies ExportedHandler;
