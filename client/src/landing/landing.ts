import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource/atkinson-hyperlegible-next/400.css';
import '@fontsource/atkinson-hyperlegible-next/500.css';
import './landing.css';
import { askForMicrophone } from './microphone.ts';

export type LandingState =
  | { kind: 'loading'; share: number }
  | { kind: 'ready'; open: () => void; openRoom: (() => void) | null; label?: string; restart?: { label: string; run: () => void } | null }
  | { kind: 'opening' }
  | { kind: 'inside' }
  | { kind: 'failed' };

const landing = (): HTMLElement | null => document.getElementById('landing');
let wired = false;

/** The first frame: the book, one button, and the voice note. Nothing else. */
export function setLandingState(state: LandingState): void {
  const root = landing();
  if (!root) return;
  const button = root.querySelector<HTMLButtonElement>('#open')!;
  const label = root.querySelector<HTMLElement>('.open-label')!;
  wireMicrophone(root);
  root.dataset.state = state.kind;
  switch (state.kind) {
    case 'loading':
      button.disabled = true;
      label.textContent = 'Getting the book ready';
      button.style.setProperty('--share', String(state.share));
      break;
    case 'ready':
      button.disabled = false;
      label.textContent = state.label ?? 'Open the book';
      const restart = root.querySelector<HTMLButtonElement>('#restart');
      if (restart) {
        restart.hidden = !state.restart;
        restart.textContent = state.restart?.label ?? '';
        restart.onclick = () => {
          // XR has to start inside this tap too.
          root.dataset.state = 'opening';
          state.restart?.run();
        };
      }
      button.onclick = () => {
        // XR has to start inside this tap, so nothing awaits before it.
        root.dataset.state = 'opening';
        state.open();
      };
      const room = root.querySelector<HTMLButtonElement>('#room')!;
      room.hidden = !state.openRoom;
      room.onclick = () => {
        root.dataset.state = 'opening';
        state.openRoom?.();
      };
      break;
    case 'opening':
    case 'inside':
      break;
    case 'failed':
      button.disabled = true;
      label.textContent = 'The book didn’t load';
      root.querySelector('.hint')!.textContent = 'Check your connection, then reload this page.';
      break;
  }
}

function wireMicrophone(root: HTMLElement): void {
  if (wired) return;
  wired = true;
  const mic = root.querySelector<HTMLButtonElement>('#mic')!;
  mic.addEventListener('click', async () => {
    if (mic.dataset.answer) return;
    const answer = await askForMicrophone(navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices));
    mic.dataset.answer = answer;
    mic.textContent = answer === 'granted' ? 'They can hear you now.' : 'The story plays the same without your voice.';
  });
  void navigator.permissions
    ?.query({ name: 'microphone' as PermissionName })
    .then((status) => {
      if (status.state === 'granted') {
        mic.dataset.answer = 'granted';
        mic.textContent = 'They can hear you now.';
      }
    })
    .catch(() => undefined);
}
