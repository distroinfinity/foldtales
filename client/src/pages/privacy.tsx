import { Shell, mount } from './shell.tsx';

mount(
  <Shell title="Privacy">
    <p>Short version: you can read the book without telling us anything. If you sign in, we keep your name, email and your place in the book, and you can delete it all.</p>
    <h2>Without an account</h2>
    <p>
      Your place in the book is kept in this browser, on this headset. The app sends us anonymous performance numbers (frame rate, load time,
      errors) under a random device code, so we can fix problems. Nothing identifies you.
    </p>
    <h2>With an account</h2>
    <p>
      When you sign in with Google or an email code, we keep your name, your email, and your book: which chapters you’ve read and where you
      stopped. That’s what lets you continue on another headset. Keepsakes you find in a chapter stay on the headset they were found on.
    </p>
    <h2>In the AI Storyteller</h2>
    <ul>
      <li>Your voice goes to a speech service to be understood, and isn’t kept.</li>
      <li>What you say and give the characters goes to an AI model (Anthropic’s Claude) to write the story, and isn’t used to train it.</li>
      <li>The shapes of your room from your Quest’s Space Setup (where the table, couch and walls are) are described to the AI, so the story can use them. No pictures of your room are taken.</li>
    </ul>
    <h2>Deleting your book</h2>
    <p>
      Signed in, open <strong>Sign in</strong> at the top of the page, then <strong>Delete my book</strong>. It removes your account, your book and every
      headset linked to it. Without an account, clearing this site’s data in the browser removes everything.
    </p>
    <h2>Questions</h2>
    <p>Use the contact on the competition page.</p>
  </Shell>,
);
