import { Map } from './components/Map';
import { ToastProvider } from './components/ToastProvider';

function App() {
  return (
    <ToastProvider>
      <div className="fixed top-0 left-0 right-0 bottom-0 overflow-hidden">
        <Map />
      </div>
    </ToastProvider>
  );
}

export default App;
