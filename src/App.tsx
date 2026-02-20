import { Map } from './components/Map';
import { ToastProvider } from './components/ToastProvider';

function App() {
  return (
    <ToastProvider>
      <div className="fixed inset-0 overflow-hidden">
        <Map />
      </div>
    </ToastProvider>
  );
}

export default App;
