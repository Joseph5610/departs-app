# 🚉 departs.app

A lightweight, fast, and distraction-free web app for viewing public transport departures in real-time. Currently supports Prague (PID) and Brno (IDS JMK).

[![Live App](https://img.shields.io/badge/Live-departs.app-emerald.svg?style=for-the-badge)](https://departs.app)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

## ✨ Features

- **Real-Time Data**: Live departures for public transport (Metro, Trams, Buses, Trains).
- **Interactive Map**: Live vehicle locations with accurate delay information and route shapes.
- **Smart Search**: Find any stop by name and view its upcoming connections.
- **PWA Ready**: Installable on iOS and Android for a native app experience.
- **Privacy First**: No ads, no tracking, just the data you need.

## 🛠️ Stack

- **Frontend**: React 19, TypeScript, Vite
- **Map**: MapLibre GL JS, React Map GL
- **Backend**: Cloudflare Pages Functions (Edge Computing)
- **Data Sources**: [Golemio API](https://api.golemio.cz/) (Prague), [KORDIS JMK](https://kordis-jmk.cz/) (Brno)
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
   TURNSTILE_SECRET_KEY=your_turnstile_secret_key
   ```
   *And in `.env` or `.env.local` for the frontend:*
   ```bash
   VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA # Dummy key for local dev
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
   - Create a KV namespace in your Cloudflare dashboard (e.g., `DEPARTS_FEEDBACK`).
   - Add the binding to your `wrangler.toml`:
     ```toml
     [[kv_namespaces]]
     binding = "DEPARTS_FEEDBACK"
     id = "your_kv_namespace_id"
     ```

2. **Cloudflare Turnstile (Bot Protection)**:
   - Create a Turnstile widget in Cloudflare.
   - Add the keys to your Cloudflare Pages Environment Variables:
     - `VITE_TURNSTILE_SITE_KEY` (Public)
     - `TURNSTILE_SECRET_KEY` (Secret)

3. **Cloudflare Access (Zero Trust)**:
   - The `/admin/*` and `/api/admin/*` routes contain sensitive user feedback and diagnostic data.
   - In your Cloudflare dashboard, navigate to Zero Trust and create an **Access Application** for the paths `departs.app/admin/*` AND `departs.app/api/admin/*`.
   - Set up a policy to allow only your personal email address or identity provider (e.g., GitHub) to access the dashboard.


## 🏗️ Project Structure

- `src/`: Frontend React application.
- `functions/api/`: Cloudflare Pages Functions (Serverless API).
- `public/`: Static assets and PWA manifest.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Built with ❤️ for commuters.
