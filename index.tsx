import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { I18nProvider } from './i18n';
import { SoundProvider } from './sound';
import '@fontsource/noto-sans-symbols-2/symbols.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Pre-load all chess fonts before rendering the app.
// Canvas fillText fails silently to default fonts if the font isn't fully loaded yet.
Promise.all([
  document.fonts.load('12px "Noto Sans Symbols 2"'),
  document.fonts.load('12px "Chess Merida Unicode"'),
  document.fonts.load('12px "FreeSerif"'),
  document.fonts.load('12px "FreeSans"')
]).then(() => {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <I18nProvider>
        <SoundProvider>
          <App />
        </SoundProvider>
      </I18nProvider>
    </React.StrictMode>
  );
});