import { Shell, mount } from './shell.tsx';

/** Terms of use: lane E's words (`docs/legal-copy.md`), pasted as written. They carry Runway's end-user terms (§2.5) and OpenAI's AI-voice disclosure. */
mount(
  <Shell title="Terms of use">
    <p>Foldtales is a storybook you read with your hands on Meta Quest. By using it, you agree to these terms.</p>
    <h2>Using Foldtales</h2>
    <p>
      You can read the chapters without an account. The AI Storyteller needs you to sign in. Please use it kindly: don’t ask it for anything
      hateful, sexual, violent, or that breaks the law or hurts someone, and don’t try to make it do so. Don’t copy, scrape or resell Foldtales or
      anything it makes, or use what it makes to build or train another AI service.
    </p>
    <h2>The AI Storyteller</h2>
    <p>
      Its stories, its voices and any pictures it paints for you are made by AI as you go, from what you say and give. The voices you hear are
      AI-generated, not people. AI can get things wrong or be surprising. If something feels off, close the book.
    </p>
    <h2>Who owns what</h2>
    <p>
      The book, its characters, its art, music and words belong to us. What the Storyteller makes for you is yours to keep and enjoy for your own,
      personal use, alongside the rights of the services that help make it.
    </p>
    <h2>Services we use</h2>
    <p>
      The Storyteller uses AI services from Anthropic (the story), OpenAI (the voices), Groq (understanding your voice) and Runway (pictures). By
      using the Storyteller, you also agree to follow their usage policies:
    </p>
    <ul>
      <li>
        Anthropic: <a href="https://www.anthropic.com/legal/aup">anthropic.com/legal/aup</a>
      </li>
      <li>
        OpenAI: <a href="https://openai.com/policies/usage-policies/">openai.com/policies/usage-policies</a>
      </li>
      <li>
        Runway: <a href="https://runway.com/terms-of-use">runway.com/terms-of-use</a>
      </li>
    </ul>
    <h2>If you break these terms</h2>
    <p>We may stop your access to the Storyteller.</p>
    <h2>No warranty</h2>
    <p>
      Foldtales is free during the Meta VR Start Developer Competition, and is provided as it is, without warranties. As far as the law allows, we
      aren’t liable for any loss from using it.
    </p>
    <h2>Changes</h2>
    <p>We may update these terms; the date below changes when we do.</p>
    <p>
      Questions: <a href="mailto:manurajput2911@gmail.com">manurajput2911@gmail.com</a>. Last updated November 2026.
    </p>
  </Shell>,
);
