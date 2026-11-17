import { Shell, mount } from './shell.tsx';

mount(
  <Shell title="Privacy">
    <p>Short version: you can read the book without telling us anything. If you sign in, we keep your name, email and your place in the book, and you can delete it all.</p>
    <h2>Without an account</h2>
    <p>
      Your place in the book is kept in this browser, on this headset. The app sends us anonymous performance numbers (frame rate and errors)
      under a random device code, so we can fix problems. It’s kept on our server in the US. Nothing in it identifies you.
    </p>
    <h2>With an account</h2>
    <p>
      When you sign in with Google or an email code, we keep your name, your email, and your book: which chapters you’ve read and where you
      stopped. That’s what lets you continue on another headset. Keepsakes you find in a chapter stay on the headset they were found on.
    </p>
    <h2>In the AI Storyteller</h2>
    <ul>
      <li>What you say is sent to Groq to be turned into words.</li>
      <li>Those words, and what you give the characters, go to Anthropic’s Claude to write the story.</li>
      <li>The characters’ lines go to OpenAI to be spoken. The voices you hear are AI-generated.</li>
      <li>If you ask for something to be painted, your request goes to Runway, which paints it.</li>
      <li>
        Anthropic, OpenAI and Groq don’t use what you send them to train their AI. They may keep it for a short time to check for misuse, as their
        policies allow.
      </li>
      <li>
        Runway’s terms let it use what you ask it to paint, and the pictures it makes, to improve its AI. Don’t ask for a picture of anything
        private.
      </li>
      <li>
        The shapes of your room from your Quest’s Space Setup (where the table, couch and walls are) are described to the AI as text, so the story
        can use them. No pictures of your room are ever taken.
      </li>
      <li>Your microphone is only on while you hold the talk button, and we never store recordings.</li>
    </ul>
    <h2>Deleting your book</h2>
    <p>
      Signed in, open <strong>Sign in</strong> at the top of the page, then <strong>Delete my book</strong>. It removes your account, your book, and every
      headset linked to it. Without an account, clearing this site’s data in the browser removes everything.
    </p>
    <h2>Questions</h2>
    <p>
      Questions: <a href="mailto:manurajput2911@gmail.com">manurajput2911@gmail.com</a>. See also the <a href="../terms/">terms of use</a>.
    </p>
  </Shell>,
);
