# 🚀 Production Deployment Guide

This guide covers everything needed to deploy the `departs.app` to Cloudflare Pages for a production environment.

## 1. Cloudflare Pages Setup

The app is designed to be hosted on Cloudflare Pages, utilizing its edge network for static assets and Cloudflare Pages Functions for backend APIs.

1. Connect your GitHub repository to Cloudflare Pages.
2. Set the build framework to **Vite** or use the following build command and directory:
   - **Build Command:** `npm run build`
   - **Build Output Directory:** `dist`

## 2. Environment Variables

In your Cloudflare Pages dashboard, go to Settings > Environment variables and add the following:

- `GOLEMIO_API_KEY`: Your API key for the Golemio API (Prague transit data).
- `VITE_TURNSTILE_SITE_KEY`: Public site key for Cloudflare Turnstile (Bot protection for feedback).
- `TURNSTILE_SECRET_KEY`: Secret key for Cloudflare Turnstile.

## 3. 🛡️ Feedback System & Admin Hub

The application includes a built-in user feedback widget and an admin dashboard protected by Cloudflare Zero Trust. To set this up for production:

### Cloudflare KV

- Create a KV namespace in your Cloudflare dashboard (e.g., `FEEDBACK_STORE`).
- Bind this namespace to your Cloudflare Pages project.
- Also, ensure the binding is in your `wrangler.toml` for local development or direct Wrangler deployments:
  ```toml
  [[kv_namespaces]]
  binding = "FEEDBACK_STORE"
  id = "your_kv_namespace_id"
  ```

### Cloudflare Turnstile (Bot Protection)

- Create a Turnstile widget in Cloudflare.
- As mentioned above, ensure `VITE_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` are set in your Environment Variables.

### Cloudflare Access (Zero Trust)

The `/admin/*` and `/api/admin/*` routes contain sensitive user feedback and diagnostic data.

- In your Cloudflare dashboard, navigate to Zero Trust and create an **Access Application** for the paths `/admin/*` and `/api/admin/*`.
- Set up a policy to allow only your personal email address or identity provider (e.g., GitHub) to access the dashboard.
