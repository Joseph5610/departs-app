import { onRequest as __api_departures_ts_onRequest } from "/Users/jozef/pid/functions/api/departures.ts"
import { onRequest as __api_stops_ts_onRequest } from "/Users/jozef/pid/functions/api/stops.ts"
import { onRequest as __api_vehicles_ts_onRequest } from "/Users/jozef/pid/functions/api/vehicles.ts"

export const routes = [
    {
      routePath: "/api/departures",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_departures_ts_onRequest],
    },
  {
      routePath: "/api/stops",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_stops_ts_onRequest],
    },
  {
      routePath: "/api/vehicles",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_vehicles_ts_onRequest],
    },
  ]