import { Map } from './components/Map';
import { ToastProvider } from './components/ToastProvider';

function App() {
  return (
    <ToastProvider>
      <Map />
    </ToastProvider>
  );
}

export default App;
