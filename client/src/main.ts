/**
 * The page's light first entry. It decides who's here, shows the page, and only on a headset
 * imports the 3D book (index.ts, with IWSDK and the art), so a phone never downloads it.
 */
import { clearIfReaderChanged } from './landing/account-ui.ts';
import { detectDevice } from './landing/device.ts';
import { setLandingState } from './landing/landing.ts';
import { mountPage } from './landing/mount.tsx';
import { registerOffline } from './offline/cache.ts';

// Before anything reads the saved place: finish a sign-out or delete from the last page.
clearIfReaderChanged();
const device = await detectDevice();
mountPage(device);
if (device === 'headset') {
  import('./index.ts').catch((cause: unknown) => {
    console.error('book', cause);
    setLandingState({ kind: 'failed' });
  });
  // The offline cache, once the book is ready (lane E).
  registerOffline(device);
}
