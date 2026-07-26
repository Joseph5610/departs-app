import { Map } from './components/Map/Map';
import { Toaster } from '@/components/ui/sonner';
import { Switch, Route } from 'wouter';
import { usePWALifecycle } from './hooks/features/usePWALifecycle';
import { FeedExplorer } from './pages/admin/FeedExplorer/FeedExplorer';
import { AdminFeedback } from './pages/admin/AdminFeedback/AdminFeedback';
import { AdminIndex } from './pages/admin/AdminIndex/AdminIndex';
import { useEnrichmentChannel } from './hooks/features/useEnrichmentChannel';
import { usePreferencesStore } from './state/preferencesStore';
import { FRONTEND_CITIES_CONFIG } from './config/cities';


function App() {
  usePWALifecycle();

  const selectedCity = usePreferencesStore(s => s.selectedCity);
  const cityConfig = FRONTEND_CITIES_CONFIG[selectedCity];
  useEnrichmentChannel(cityConfig?.enrichmentChannel ?? null);

  return (
    <>
      {/* Visually hidden SEO content */}
      <div className="sr-only">
        <h1>departs.app — MHD Praha & Brno LIVE</h1>
        <p>
          Sledujte polohu vozidel MHD v reálném čase.
          Aktuální odjezdy ze všech zastávek, informace o zpoždění a interaktivní mapa spojů pro Prahu (PID) a Brno (IDS JMK).
        </p>
        <p>
          Real-time visualization of Prague and Brno public transport. Track live locations of vehicles,
          view upcoming departures, and check current delays on an interactive map.
        </p>
      </div>

      <Switch>
        <Route path="/admin/explorer">
          <FeedExplorer />
        </Route>
        <Route path="/admin/feedback">
          <AdminFeedback />
        </Route>
        <Route path="/admin">
          <AdminIndex />
        </Route>
        <Route>
          <Map />
        </Route>
      </Switch>
      <Toaster position="bottom-center" />
    </>
  );
}

export default App;
