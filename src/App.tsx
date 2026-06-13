import { Map } from './components/Map/Map';
import { Toaster } from '@/components/ui/sonner';
import { Switch, Route, useLocation } from 'wouter';
import { usePWALifecycle } from './hooks/features/usePWALifecycle';
import { FeedExplorer } from './pages/FeedExplorer/FeedExplorer';
import { usePreferencesStore } from './state/preferencesStore';
import { useEffect } from 'react';

const RootRedirect = () => {
  const selectedCity = usePreferencesStore(s => s.selectedCity);
  const [, navigate] = useLocation();
  
  useEffect(() => {
    navigate(`/${selectedCity}`, { replace: true });
  }, [selectedCity, navigate]);
  
  return null;
};

function App() {
  usePWALifecycle();

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
        <Route path="/explorer">
          <FeedExplorer />
        </Route>
        <Route path="/">
          <RootRedirect />
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
