import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource/anton/400.css';
import '@fontsource/chakra-petch/500.css';
import '@fontsource/chakra-petch/600.css';
import '@fontsource/chakra-petch/700.css';
// polices du jeu (interface de combat, cinématique, écran de chargement)
import '@fontsource/barlow-semi-condensed/400.css';
import '@fontsource/barlow-semi-condensed/600.css';
import '@fontsource/barlow-semi-condensed/700-italic.css';
import './styles/main.css';
import './styles/components.css';
import './styles/pages.css';
import { App } from './App';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Élément #root introuvable dans index.html.');
}

createRoot(root).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
