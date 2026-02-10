# 🚉 departs.app

A lightweight, fast, and distraction-free web app for viewing Prague's public transport departures in real-time.

[![Live App](https://img.shields.io/badge/Live-departs.app-emerald.svg?style=for-the-badge)](https://departs.app)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

## ✨ Features

- **Real-Time Data**: Live departures for all Prague public transport (Metro, Trams, Buses, Trains).
- **Interactive Map**: Live vehicle locations with accurate delay information and route shapes.
- **Smart Search**: Find any stop by name and view its upcoming connections.
- **PWA Ready**: Installable on iOS and Android for a native app experience.
- **Privacy First**: No ads, no tracking, just the data you need.

## 🛠️ Stack

- **Frontend**: React 19, TypeScript, Vite
- **Map**: MapLibre GL JS, React Map GL
- **Backend**: Cloudflare Pages Functions (Edge Computing)
- **Data Source**: [Golemio API](https://api.golemio.cz/)
- **Styling**: Tailwind CSS 4, Framer Motion

## 🚀 Local Development

### Prerequisites

- **Node.js**: v20 or higher
- **Wrangler**: `npm install -g wrangler` (for Cloudflare Functions)
- **API Key**: A free API key from [api.golemio.cz](https://api.golemio.cz/)

### Setup

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

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Built with ❤️ for Prague's commuters.
