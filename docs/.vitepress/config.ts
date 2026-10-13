import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';

/** GitHub's heading anchors, so `#8-ride-push-worker-optional` works on GitHub and on the docs site alike. */
const githubSlug = (heading: string): string =>
    heading.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');

export default withMermaid(defineConfig({
    title: 'departs.app docs',
    description: 'Running, deploying and integrating departs.app, a real-time public transport PWA.',
    // Set by the Docs workflow: "/departs-app/" on GitHub Pages, "/" on a custom domain.
    base: process.env.DOCS_BASE ?? '/',
    cleanUrls: true,
    // mermaid's CommonJS dependencies need pre-bundling in the dev server.
    vite: { optimizeDeps: { include: ['mermaid', 'fastdom'] } },
    markdown: { anchor: { slugify: githubSlug } },
    themeConfig: {
        nav: [
            { text: 'departs.app', link: 'https://departs.app' },
            { text: 'GitHub', link: 'https://github.com/Joseph5610/departs-app' },
        ],
        sidebar: [
            {
                text: 'Getting started',
                items: [
                    { text: 'Overview', link: '/' },
                    { text: 'Local development', link: '/local-development' },
                ],
            },
            {
                text: 'Deployment',
                items: [
                    { text: 'Production deployment', link: '/deployment' },
                    { text: 'Ride push deployment', link: '/ride-push-deployment' },
                ],
            },
            {
                text: 'Internals',
                items: [{ text: 'Ride notifications', link: '/ride-notifications' }],
            },
            {
                text: 'Reference',
                items: [
                    { text: 'Remote MCP server', link: '/mcp-server' },
                    { text: 'Data sources and licences', link: '/data-sources' },
                ],
            },
        ],
        outline: { level: [2, 3] },
        search: { provider: 'local' },
        editLink: { pattern: 'https://github.com/Joseph5610/departs-app/edit/master/docs/:path' },
        socialLinks: [{ icon: 'github', link: 'https://github.com/Joseph5610/departs-app' }],
    },
}));
