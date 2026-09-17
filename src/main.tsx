import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { LanguageProvider } from './context/LanguageContext';
import './index.css';

// Proteção global contra imagens externas quebradas. Alguns cards antigos ainda
// usam <img> diretamente; ocultamos apenas a imagem que falhou, permitindo que
// o fallback visual/abreviação que já existe no card permaneça visível.
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    const target = event.target;
    if (target instanceof HTMLImageElement) {
      target.style.display = 'none';
      target.setAttribute('data-image-failed', 'true');
    }
  }, true);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
);
