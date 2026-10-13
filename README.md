# 🚉 departs.app

Real-time public transport for Czech and Slovak cities: live departures, vehicles on a map and stop alerts, in an installable PWA. Live in Prague (PID), Brno (IDS JMK) and Prešov (DPMP).

[![Live App](https://img.shields.io/badge/Live-departs.app-emerald.svg?style=for-the-badge)](https://departs.app)
[![Docs](https://img.shields.io/badge/Docs-docs.departs.app-purple.svg?style=for-the-badge)](https://docs.departs.app)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

## 📚 Documentation

Full documentation: **[docs.departs.app](https://docs.departs.app)**

- [Overview](./docs/index.md): features, architecture and stack.
- [Local development](./docs/local-development.md): run the app on your machine.
- [Production deployment](./docs/deployment.md): set up the app on Cloudflare, step by step.
- [Ride push deployment](./docs/ride-push-deployment.md): add Web Push for ride mode.
- [Ride notifications](./docs/ride-notifications.md): how ride-mode push works inside.
- [Remote MCP server](./docs/mcp-server.md): connect AI assistants to live transit data.
- [Data sources and licences](./docs/data-sources.md): where the data comes from and on what terms.

## 🚀 Quick start

```bash
git clone https://github.com/Joseph5610/departs-app.git
cd departs-app
npm install
cp .dev.vars.example .dev.vars   # add your Golemio API key
npm run dev                      # http://localhost:8788
```

See [Local development](./docs/local-development.md) for details.

## 📄 License

The code is under the [MIT License](LICENSE). The transit data keeps its sources' own terms, listed in [Data sources and licences](./docs/data-sources.md).
