# 🚉 departs.app

A lightweight, fast, and distraction-free web app for viewing public transport departures in real-time. Currently supports Prague (PID), Brno (IDS JMK) and Prešov (DPMP).

[![Live App](https://img.shields.io/badge/Live-departs.app-emerald.svg?style=for-the-badge)](https://departs.app)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

## ✨ Features

- **Real-Time Data**: Live departures for public transport (Metro, Trams, Buses, Trains).
- **Interactive Map**: Live vehicle locations with accurate delay information and route shapes.
- **Smart Search**: Find any stop by name and view its upcoming connections.
- **PWA**: Web-App installable on iOS and Android for a native app experience.
- **Privacy First**: No ads, no tracking, just the data you need.

## 🛠️ Stack

- **Frontend**: React 19, TypeScript, Vite
- **Map**: MapLibre GL JS, React Map GL
- **Backend**: Cloudflare Pages Functions (Edge Computing)
- **Data Sources**: [Golemio API](https://api.golemio.cz/) (Prague), [KORDIS JMK](https://kordis-jmk.cz/) (Brno), [DPMP / Mesto Prešov](https://www.arcgis.com/home/item.html?id=f1033ca6c2f4461d9aba285e1c7cb079) (Prešov), [Portabo](https://tabule.portabo.cz) and CIS JŘ (Ústecký kraj); see [License](#-license) for terms
- **Styling**: Tailwind CSS 4, Framer Motion

## 📚 Documentation

For deep dives into how Departs works and how to set it up, check out our documentation:

- [🚀 Production Deployment Guide](./docs/deployment.md) - Full Cloudflare deployment (KV, Turnstile, Zero Trust).
- [🤖 Remote MCP Server](./docs/mcp-server.md) - Connect AI assistants to real-time transit data.

## 🚀 Local Development

### Prerequisites

- **Node.js**: v24 or higher
- **Wrangler**: `npm install -g wrangler` (for Cloudflare Functions)
- **API Keys**: A free API key from [api.golemio.cz](https://api.golemio.cz/)

### Quick Setup

1. **Clone the repository**:

   ```bash
   git clone https://github.com/joseph5610/departs-app.git
   cd departs-app
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Configure Environment**:
   Create a `.dev.vars` file in the root (copied from `.dev.vars.example`):

   ```bash
   GOLEMIO_API_KEY=your_actual_key_here
   ```

4. **Run development server**:
   ```bash
   npm run dev
   ```

### Building

To create an optimized production build:

```bash
npm run build
```

## 🏗️ Project Structure

- `src/`: Frontend React application.
- `functions/api/`: Cloudflare Pages Functions (Serverless API).
- `public/`: Static assets and PWA manifest.

## 📄 License

The code is licensed under the MIT License, see the [LICENSE](LICENSE) file. The transit data it shows is not: each source keeps its own terms.

| Region | Source (credit) | Licence |
| --- | --- | --- |
| Prague | [PID open data](https://pid.cz/o-systemu/opendata/) and PID realtime data via [Golemio](https://golemio.cz) (ROPID, Operátor ICT) | CC BY 4.0 |
| Brno | [IDS JMK GTFS and GTFS-RT](https://data.brno.cz/datasets/379d2e9a7907460c8ca7fda1f3e84328), [vehicle positions](https://data.brno.cz/datasets/e8aa121910df41bb9a28e4ca34a263c7) (Statutární město Brno, KORDIS JMK) | CC BY 4.0 |
| Brno | Route shapes from the Lissy API (FIT VUT Brno); the [Lissy](https://github.com/Jorgen98/Lissy) tool itself is GPL-3.0 | Used with the author's explicit permission |
| Prešov | [GTFS – MHD Prešov](https://www.arcgis.com/home/item.html?id=f1033ca6c2f4461d9aba285e1c7cb079) and [on-line vehicle positions](https://egov.presov.sk/geodatakatalog/) (Dopravný podnik mesta Prešov, a.s.) | CC BY 4.0 |
| Ústecký kraj | [Ústecký kraj open data (Portabo)](https://lkod.portabo.cz/datasets) and [CIS JŘ timetables](https://data.gov.cz/datová-sada?iri=https%3A%2F%2Fdata.gov.cz%2Fzdroj%2Fdatové-sady%2F66003008%2F1463646434) (Ministerstvo dopravy ČR) | Czech open data without copyright or database rights |
| All | Map data and place search: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), CARTO basemaps, Photon by komoot | ODbL 1.0 |

departs.app changes this data before showing it: timetables are converted, filtered and matched to stops and platforms, and combined with the live feeds. The processed static data, with the changes made to each source, is published in [departs-data](https://github.com/Joseph5610/departs-data#-license) under CC BY 4.0. The providers do not endorse departs.app. The app credits every source, its licence and these changes in Settings → Data sources & licences.

---

Built with ❤️ for all commuters.
