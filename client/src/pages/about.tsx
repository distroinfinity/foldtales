import content from '../landing/page-content.json';
import { Shell, mount } from './shell.tsx';

mount(
  <Shell title="About">
    <p>
      <strong>Foldtales</strong> is a living storybook for Meta Quest. A painted pop-up book opens on your real table. Reach in and help the
      characters through each chapter, or make up a new story with the AI Storyteller.
    </p>
    <h2>The book</h2>
    <p>{content.about.book}</p>
    <p>Each chapter takes about six minutes and needs only your hands. You don’t need an account to read one.</p>
    <h2>The AI Storyteller</h2>
    <p>{content.about.storyteller}</p>
    <h2>Made for</h2>
    <p>The Meta VR Start Developer Competition, 2026. Built for the web with Meta’s Immersive Web SDK, and tested on a Quest 3.</p>
    <h2>Credits</h2>
    <ul>
      <li>Art: painted with AI (Seedream, through Runway) from our own designs and references, then cut out and rigged by hand.</li>
      <li>Voices: ElevenLabs voices, through Runway. Sound effects: made through Runway.</li>
      <li>Type: Fraunces and Atkinson Hyperlegible Next, under the SIL Open Font License.</li>
      <li>Code: Immersive Web SDK and Three.js, troika-three-text, React, Motion, Tailwind CSS, Better Auth, Hono, and components adapted from Magic UI, each under the MIT licence.</li>
    </ul>
    <p>
      Every licence, in full: <a href="../notices.txt">third-party notices</a>.
    </p>
    <p className="text-[15px] opacity-70">
      <a href="https://runwayml.com" target="_blank" rel="noopener">
        Powered by Runway
      </a>
    </p>
  </Shell>,
);
