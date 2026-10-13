/** Entry of the `departs-ride-push` Worker (`workers/ride-push/wrangler.toml`): only hosts `RideWatch`, reached through the Pages binding. */
export { RideWatch } from './RideWatch';

export default {
    fetch: () => new Response('Not found', { status: 404 }),
} satisfies ExportedHandler;
