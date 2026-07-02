import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AppDataProvider } from './hooks/useAppData.tsx';

// Auto-reload on chunk load failures (SPA deployment updates)
window.addEventListener('error', (e) => {
  const msg = e.message || '';
  if (msg.includes('Failed to fetch dynamically imported module') || msg.includes('Expected a JavaScript-or-Wasm module script')) {
    console.warn('Dynamic import failed, reloading to latest deployment version...');
    window.location.reload();
  }
}, true);

window.addEventListener('unhandledrejection', (e) => {
  const msg = String(e.reason?.message || e.reason || '');
  if (msg.includes('Failed to fetch dynamically imported module') || msg.includes('Expected a JavaScript-or-Wasm module script')) {
    console.warn('Dynamic import failed (promise), reloading to latest deployment version...');
    window.location.reload();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppDataProvider>
      <App />
    </AppDataProvider>
  </StrictMode>,
);
