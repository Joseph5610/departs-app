# 🤖 Remote MCP Server (AI Integration)

`departs.app` hosts a public **Remote Model Context Protocol (MCP) Server** at `https://departs.app/mcp`. No local package or CLI installation is required. You can connect AI assistants like **Claude** or other MCP-compatible clients directly to real-time transit data.

## Features & Available Tools

- `search_stops`: Search stops/stations in Prague (PID) or Brno (IDS JMK) by name or query.
- `search_nearest_stops`: Find public transit stops/stations closest to a geographic location (latitude/longitude).
- `get_next_departures`: Get real-time upcoming departures from a specific stop name or ID.
- `get_nearest_departures`: Get real-time upcoming departures for stops closest to a geographic location.
- `get_realtime_vehicles`: Live vehicle GPS locations, line numbers, and delays.
- `get_service_alerts`: Active traffic disruptions, closures, detours, and news.
- `get_vehicle_detail`: Trip itinerary, schedule progress, and vehicle info.

## Quick Connect

### Claude Code CLI

```bash
claude mcp add --transport sse departs https://departs.app/mcp
```

### Claude Desktop (`claude_desktop_config.json`)

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
