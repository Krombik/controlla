import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from '#App';

// the page's loads start here, before React is even asked to render
import '#preloads';

import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
