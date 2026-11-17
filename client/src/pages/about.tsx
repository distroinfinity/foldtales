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
      <li>
        <strong>Art:</strong> painted with AI (Seedream, through Runway) from our own designs and references, then cut out, finished and rigged by
        hand.
      </li>
      <li>
        <strong>Chapter voices and sound:</strong> ElevenLabs voices and sound effects, made through Runway before release.
      </li>
      <li>
        <strong>Music:</strong> “Piano Ambience chord progression 82bpm” by CVLTIV8R, from Freesound, under CC0.
      </li>
      <li>
        <strong>The AI Storyteller:</strong> stories by Anthropic’s Claude. Voices by OpenAI, and AI-generated. Listening by Groq. Live pictures
        powered by{' '}
        <a href="https://runway.com" target="_blank" rel="noopener">
          Runway
        </a>
        .
      </li>
      <li>
        <strong>Type:</strong> Fraunces, Atkinson Hyperlegible Next and Cormorant Garamond, under the SIL Open Font License.
      </li>
      <li>
        <strong>Code:</strong> Immersive Web SDK, Three.js, troika-three-text, React, Motion, Tailwind CSS and others, under their open-source
        licences, with components adapted from Magic UI.
      </li>
    </ul>
    <p>
      Every licence, in full: <a href="../notices.txt">third-party notices</a>.
    </p>
    <p className="text-[15px] opacity-70">
      <a href="https://runway.com" target="_blank" rel="noopener">
        Powered by Runway
      </a>
    </p>
  </Shell>,
);
