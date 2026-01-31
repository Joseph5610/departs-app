import { Map } from './components/Map';
import { ToastProvider } from './components/Toast';

function App() {
  return (
    <ToastProvider>
      <div className="w-full h-full overflow-hidden">
        <Map />
      </div>
    </ToastProvider>
  );
}

export default App;
