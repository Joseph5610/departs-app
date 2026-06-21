import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { usePreferencesStore } from '../../state/preferencesStore';
import { apiFetch } from '../../lib/api-client';
import type { DeparturesResponse } from '../data/useDepartures';
import type { StopCollection } from '../../types/transit';

interface WebMCPTool {
  name: string;
  description: string;
  inputSchema: object;
  execute: (args: unknown) => unknown;
}

interface ModelContext {
  provideContext?: (context: { tools: WebMCPTool[] }) => void;
  registerTool?: (tool: WebMCPTool) => void;
}

declare global {
  interface Navigator {
    modelContext?: ModelContext;
  }
}

export const useWebMCP = () => {
  const [, navigate] = useLocation();
  const selectedCity = usePreferencesStore(s => s.selectedCity);

  useEffect(() => {
    if (!navigator.modelContext) return;

    const tools: WebMCPTool[] = [
      {
        name: 'navigate_to_stop',
        description: 'Navigate to a specific public transport stop by its ID to view its real-time departures.',
        inputSchema: {
          type: 'object',
          properties: {
            stopId: {
              type: 'string',
              description: 'The ID of the stop (e.g., U850Z1P)'
            }
          },
          required: ['stopId']
        },
        execute: async (rawArgs: unknown) => {
          const args = rawArgs as { stopId: string };
          navigate(`/${selectedCity}/stop/${args.stopId}`);
          return { success: true, message: `Navigated to stop ${args.stopId}` };
        }
      },
      {
        name: 'navigate_to_home',
        description: 'Navigate to the home map view.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        },
        execute: async () => {
          navigate(`/${selectedCity}`);
          return { success: true, message: 'Navigated to home' };
        }
      },
      {
        name: 'navigate_to_trip',
        description: 'Navigate to a specific trip or vehicle to track it on the map.',
        inputSchema: {
          type: 'object',
          properties: {
            tripId: { type: 'string', description: 'The ID of the trip' },
            vehicleId: { type: 'string', description: 'Optional ID of the specific vehicle' }
          },
          required: ['tripId']
        },
        execute: async (rawArgs: unknown) => {
          const args = rawArgs as { tripId: string, vehicleId?: string };
          const path = args.vehicleId 
            ? `/${selectedCity}/trip/${args.tripId}/${args.vehicleId}`
            : `/${selectedCity}/trip/${args.tripId}`;
          navigate(path);
          return { success: true, message: `Navigated to trip ${args.tripId}` };
        }
      },
      {
        name: 'set_active_city',
        description: 'Change the active city (transit network).',
        inputSchema: {
          type: 'object',
          properties: {
            city: { type: 'string', enum: ['prague', 'brno'], description: 'The city to switch to' }
          },
          required: ['city']
        },
        execute: async (rawArgs: unknown) => {
          const args = rawArgs as { city: 'prague' | 'brno' };
          usePreferencesStore.getState().actions.setSelectedCity(args.city);
          navigate(`/${args.city}`);
          return { success: true, message: `Switched city to ${args.city}` };
        }
      },
      {
        name: 'toggle_map_layers',
        description: 'Toggle visibility of vehicles, stops, or labels on the map.',
        inputSchema: {
          type: 'object',
          properties: {
            showVehicles: { type: 'boolean' },
            showStops: { type: 'boolean' },
            showStopLabels: { type: 'boolean' }
          }
        },
        execute: async (rawArgs: unknown) => {
          const args = rawArgs as { showVehicles?: boolean, showStops?: boolean, showStopLabels?: boolean };
          const actions = usePreferencesStore.getState().actions;
          if (args.showVehicles !== undefined) actions.setShowVehicles(args.showVehicles);
          if (args.showStops !== undefined) actions.setShowStops(args.showStops);
          if (args.showStopLabels !== undefined) actions.setShowStopLabels(args.showStopLabels);
          return { success: true, message: 'Map layers updated' };
        }
      },
      {
        name: 'open_settings',
        description: 'Open the application settings modal.',
        inputSchema: {
          type: 'object',
          properties: {}
        },
        execute: async () => {
          usePreferencesStore.getState().actions.setIsSettingsOpen(true);
          return { success: true, message: 'Settings opened' };
        }
      },
      {
        name: 'get_departures',
        description: 'Fetch real-time departure data for a specific stop as raw JSON. Useful for answering specific questions about timetables or delays without navigating.',
        inputSchema: {
          type: 'object',
          properties: {
            stopId: { type: 'string', description: 'The ID of the stop (e.g., U850Z1P)' }
          },
          required: ['stopId']
        },
        execute: async (rawArgs: unknown) => {
          const args = rawArgs as { stopId: string };
          try {
            const data = await apiFetch<DeparturesResponse>(`/${selectedCity}/departures?stopId=${encodeURIComponent(args.stopId)}`);
            if (!data?.departures) return { success: false, message: 'No departures found' };
            // Return top 15 departures to save context limit, trimming unnecessary nested metadata
            const trimDeps = data.departures.slice(0, 15).map(d => ({
               line: d.line,
               headsign: d.headsign,
               scheduled: d.scheduled,
               delay: d.delay,
               platform: d.platform,
               tripId: d.tripId
            }));
            return { success: true, count: trimDeps.length, departures: trimDeps };
          } catch (e: unknown) {
            return { success: false, error: e instanceof Error ? e.message : 'Failed to fetch departures' };
          }
        }
      },
      {
        name: 'search_stops',
        description: 'Search for public transport stops by name to get their IDs. Useful before calling navigate_to_stop or get_departures.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'The name or partial name of the stop to search for (e.g., "Hlavni nadrazi")' },
            city: { type: 'string', enum: ['prague', 'brno'], description: 'Optional city to search in' }
          },
          required: ['query']
        },
        execute: async (rawArgs: unknown) => {
          const args = rawArgs as { query: string, city?: 'prague' | 'brno' };
          const targetCity = args.city || selectedCity;
          try {
            const data = await apiFetch<StopCollection>(`/${targetCity}/stops`);
            if (!data?.features) return { success: false, message: 'Failed to load stops dictionary' };
            
            const q = args.query.toLowerCase();
            const results = data.features
              .filter(f => f.properties.stop_name?.toLowerCase().includes(q))
              // Remove duplicate names if they share the same parent station or just return a clean list
              .map(f => ({
                id: f.properties.stop_id,
                name: f.properties.stop_name,
                is_centroid: f.properties.is_centroid
              }));

            // Deduplicate by ID
            const uniqueResults = Array.from(new Map(results.map(item => [item.id, item])).values());
            
            // Prioritize centroids (parent stations) and limit to 10 results
            uniqueResults.sort((a, b) => (a.is_centroid === b.is_centroid ? 0 : a.is_centroid ? -1 : 1));
            
            return { success: true, count: uniqueResults.length, results: uniqueResults.slice(0, 10) };
          } catch (e: unknown) {
            return { success: false, error: e instanceof Error ? e.message : 'Failed to search stops' };
          }
        }
      }
    ];

    if (navigator.modelContext.provideContext) {
      navigator.modelContext.provideContext({ tools });
    } else if (navigator.modelContext.registerTool) {
      tools.forEach(tool => navigator.modelContext?.registerTool?.(tool));
    }
  }, [navigate, selectedCity]);
};
