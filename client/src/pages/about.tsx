import { Shell, mount } from './shell.tsx';

mount(
  <Shell title="About">
    <p>
      <strong>Tabletop Theater</strong> is a living storybook for Meta Quest. A painted pop-up book opens on your real table. Reach in and help the
      characters through each chapter, or make up a new story with the AI Storyteller.
    </p>
    <h2>The book</h2>
    <p>
      <em>Tales from the Table’s Edge</em> is set in the Lost and Found, where everything lost in a house drifts home to a lighthouse at the edge of
      the table. Pip is a young fox, afraid of the dark, who quietly wants to be the next keeper. Wick is the grumpy old keeper, secretly losing his
      sight. Moth flies at anything bright, and brings odd finds.
    </p>
    <p>Each chapter takes about six minutes and needs only your hands. You don’t need an account to read one.</p>
    <h2>The AI Storyteller</h2>
    <p>
      Talk to Pip, Wick and Moth, hand them anything, and the AI makes up the story as you go, voiced live. It needs an account and the internet.
    </p>
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
      The full list is in <code>CREDITS.md</code>.
    </p>
  </Shell>,
);
