import { Map } from './components/Map';
import { ToastProvider } from './components/ToastProvider';

function App() {
  return (
    <ToastProvider>
      {/* Visually hidden SEO content */}
      <div className="sr-only">
        <h1>departs.app — Pražská integrovaná doprava LIVE</h1>
        <p>
          Sledujte polohu vozidel pražské MHD (metro, tramvaje, autobusy, vlaky) v reálném čase.
          Aktuální odjezdy ze všech zastávek, informace o zpoždění a interaktivní mapa spojů PID.
        </p>
        <p>
          Real-time visualization of Prague public transport. Track live locations of PID vehicles,
          view upcoming departures, and check current delays on an interactive map.
        </p>
      </div>

      <Map />
    </ToastProvider>
  );
}

export default App;
