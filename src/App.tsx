import { lazy, Suspense } from 'react';
import { Map } from './components/Map/Map';
import { Toaster } from '@/components/ui/sonner';
import { Switch, Route } from 'wouter';
import { usePWALifecycle } from './hooks/features/usePWALifecycle';
import { useEnrichmentChannel } from './hooks/features/useEnrichmentChannel';
import { useCityConfig } from './hooks/data/useCities';
import { SITE_TITLE } from './config/constants';

const AdminRoutes = lazy(() => import('./pages/admin/AdminRoutes'));

function App() {
  usePWALifecycle();

  useEnrichmentChannel(useCityConfig().enrichmentChannel ?? null);

  return (
    <>
      {/* Visually hidden SEO content */}
      <div className="sr-only">
        <h1>{SITE_TITLE}</h1>
        <p>
          Sledujte polohu vozidel MHD v reálném čase.
          Aktuální odjezdy ze všech zastávek, informace o zpoždění a interaktivní mapa spojů pro Prahu (PID), Brno (IDS JMK) a Prešov (DPMP).
        </p>
        <p>
          Real-time visualization of Prague, Brno and Prešov public transport. Track live locations of vehicles,
          view upcoming departures, and check current delays on an interactive map.
        </p>
      </div>

      <Switch>
        <Route path="/admin/*?">
          <Suspense fallback={null}>
            <AdminRoutes />
          </Suspense>
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
