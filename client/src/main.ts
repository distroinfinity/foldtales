/**
 * The page's light first entry. It decides who's here, shows the page, and only on a headset
 * imports the 3D book (index.ts, with IWSDK and the art), so a phone never downloads it.
 */
import { detectDevice } from './landing/device.ts';
import { setLandingState } from './landing/landing.ts';
import { mountPage } from './landing/mount.tsx';

const device = await detectDevice();
mountPage(device);
if (device === 'headset') {
  import('./index.ts').catch((cause: unknown) => {
    console.error('book', cause);
    setLandingState({ kind: 'failed' });
  });
}
