# Remote MCP server

departs.app runs a public [Model Context Protocol](https://modelcontextprotocol.io) server at `https://departs.app/mcp`. AI assistants such as Claude can connect to it and query live departures, vehicles and service alerts. Clients connect with the URL alone.

It speaks MCP's **Streamable HTTP** transport (JSON-RPC over `POST`) and covers the public networks: Prague (PID), Brno (IDS JMK) and Prešov (DPMP).

## Connect

### Claude Code

```bash
claude mcp add --transport http departs https://departs.app/mcp
```

### Claude Desktop

Add it to `claude_desktop_config.json` through [`mcp-remote`](https://www.npmjs.com/package/mcp-remote):

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

### Other clients

Any MCP client that supports remote Streamable HTTP servers can use the URL `https://departs.app/mcp` directly.

## Tools

Every tool takes an optional `city` (`prague`, `brno` or `presov`; default `prague`).

| Tool | What it returns |
| ---- | --------------- |
| `search_stops` | Stops and stations matching a name or query |
| `search_nearest_stops` | Stops closest to a latitude and longitude |
| `get_next_departures` | Live upcoming departures from a stop, by ID, by name, or closest to a location |
| `get_nearest_departures` | Live upcoming departures from the stops closest to a location |
| `get_realtime_vehicles` | Live vehicle positions, lines and delays |
| `get_service_alerts` | Active disruptions, closures and detours |
| `get_vehicle_detail` | A trip's stops, its progress against the timetable and vehicle details |

## Example prompts

- "When is the next tram from Anděl towards Smíchovské nádraží?"
- "Are there any disruptions on the Prague metro right now?"
- "Which stops are closest to 49.1951, 16.6068 in Brno, and what leaves from them?"

## Limits

The server shares the app's API rate limit (40 requests per 10 seconds per IP). Departures and vehicles are cached at the edge for about 10 seconds, so polling faster returns the same data.
