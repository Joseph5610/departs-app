# 🚉 departs.app

A lightweight, fast, and distraction-free web app for viewing public transport departures in real-time. Currently supports Prague (PID) and Brno (IDS JMK).

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
- **Data Sources**: [Golemio API](https://api.golemio.cz/) (Prague), [KORDIS JMK](https://kordis-jmk.cz/) (Brno)
- **Styling**: Tailwind CSS 4, Framer Motion

## 🤖 Remote MCP Server (AI Integration)

`departs.app` hosts a public **Remote Model Context Protocol (MCP) Server** at `https://departs.app/mcp`. No local package or CLI installation is required. You can connect AI assistants like **Claude** or other MCP-compatible clients directly to real-time transit data.

### Features & Available Tools

- `search_stops`: Search stops/stations in Prague (PID) or Brno (IDS JMK).
- `get_next_departures`: Real-time departures with delays, headsigns, and accessibility.
- `get_realtime_vehicles`: Live vehicle GPS locations, line numbers, and delays.
- `get_service_alerts`: Active traffic disruptions, closures, detours, and news.
- `get_vehicle_detail`: Trip itinerary, schedule progress, and vehicle info.

### Quick Connect

#### Claude Code CLI

```bash
claude mcp add --transport sse departs https://departs.app/mcp
```

#### Claude Desktop (`claude_desktop_config.json`)

Claude Desktop connects to public remote SSE endpoints using `mcp-remote` (no login/OAuth needed):

```json
{
  "mcpServers": {
    "departs": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://departs.app/mcp"]
    }
  }
}
```

## 🚀 Local Development

### Prerequisites

- **Node.js**: v24 or higher
- **Wrangler**: `npm install -g wrangler` (for Cloudflare Functions)
- **API Keys**: A free API key from [api.golemio.cz](https://api.golemio.cz/), free Cloudflare Turnstile API key for the Feedback system

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

## 🛡️ Feedback System & Admin Hub

The application includes a built-in user feedback widget and an admin dashboard protected by Cloudflare Zero Trust. To set this up for production:

1. **Cloudflare KV**:
   - Create a KV namespace in your Cloudflare dashboard (e.g., `FEEDBACK_STORE`).
   - Add the binding to your `wrangler.toml`:
     ```toml
     [[kv_namespaces]]
     binding = "FEEDBACK_STORE"
     id = "your_kv_namespace_id"
     ```

2. **Cloudflare Turnstile (Bot Protection)**:
   - Create a Turnstile widget in Cloudflare.
   - Add the keys to your Cloudflare Pages Environment Variables:
     - `VITE_TURNSTILE_SITE_KEY` (Public)
     - `TURNSTILE_SECRET_KEY` (Secret)

3. **Cloudflare Access (Zero Trust)**:
   - The `/admin/*` and `/api/admin/*` routes contain sensitive user feedback and diagnostic data.
   - In your Cloudflare dashboard, navigate to Zero Trust and create an **Access Application** for the paths `/admin/*` and `/api/admin/*`.
   - Set up a policy to allow only your personal email address or identity provider (e.g., GitHub) to access the dashboard.

## 🏗️ Project Structure

- `src/`: Frontend React application.
- `functions/api/`: Cloudflare Pages Functions (Serverless API).
- `public/`: Static assets and PWA manifest.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Built with ❤️ for all commuters.
