import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/600-italic.css';
import '@fontsource/atkinson-hyperlegible-next/400.css';
import '@fontsource/atkinson-hyperlegible-next/500.css';
import './page.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app.tsx';
import type { Device } from './device.ts';

export function mountPage(device: Device): void {
  const root = document.getElementById('landing');
  if (!root) return;
  document.documentElement.dataset.device = device;
  createRoot(root).render(
    <StrictMode>
      <App device={device} />
    </StrictMode>,
  );
}
