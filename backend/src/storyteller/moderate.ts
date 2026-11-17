import { z } from 'zod';
import { REACTOR, type Claude } from '../director/claude.ts';

const FIT = { type: 'object', additionalProperties: false, required: ['fit'], properties: { fit: { type: 'boolean' } } };
const fitOnly = z.object({ fit: z.boolean() });

const READER =
  'You check what a reader says out loud to the characters of a cozy, PG bedtime storybook for teens and adults. Answer fit=false only for sexual content, graphic violence or gore, slurs or hate, self-harm, or real-world harmful instructions. Silly, rude-but-mild, scary-but-gentle, sad or odd is fit=true.';

const OUTPUT =
  'You check one line a storybook character is about to say aloud (or a story\'s title or summary) in a cozy, PG bedtime storybook for teens and adults, set in a lost-and-found at the edge of a table. Answer fit=false for anything sexual, graphically violent or gory, hateful or slurring, about self-harm, giving real-world harmful instructions, cruel to the reader, naming a real living person as a target, or breaking the story to talk about AI, screens, apps or games. Gentle peril, mild grumpiness, sadness and silliness are fit=true.';

const PICTURE = `You look at one picture painted live for a cozy, PG picture book, before it is shown to the reader. It must be: a single object (not a scene, a person or an animal's face filling the frame), painted in a soft watercolour-and-pencil storybook style, PG, with no words, letters or logos, and recognisably the thing asked for. Answer fit=true only if all of these hold.`;

/** Is what the reader said fit to steer the story? Runs alongside the turn. Fails open (4 s): Claude's PG rules and the output check are the next lines. */
export function createModerator(claude: Claude) {
  return async (text: string): Promise<boolean> => {
    try {
      const answer = await claude.ask({ model: REACTOR, system: READER, user: text, schema: FIT, parse: fitOnly, maxTokens: 50, timeoutMs: 4000, estimate: 'checkInput' });
      return answer.fit;
    } catch {
      return true;
    }
  };
}

/**
 * Is a generated line, title or summary fit to be heard or saved? Fails closed: a refusal is false at
 * once; an error or a timeout (2.5 s) is tried once more, then false, and the caller tells it in story.
 * The retry is for the closing turn, whose title, summary and lines are all checked at once: in the live
 * voice proof (Nov 17) one of them timed out in both runs, and the ending became a redirect.
 */
export function createLineCheck(claude: Claude, timeoutMs = 2500, log: (m: string) => void = () => {}, showText = false) {
  return async (text: string): Promise<boolean> => {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const started = Date.now();
      try {
        const answer = await claude.ask({ model: REACTOR, system: OUTPUT, user: text, schema: FIT, parse: fitOnly, maxTokens: 50, timeoutMs, estimate: 'checkLine' });
        // Why a line was stopped; the line itself only on a dev backend (`showText`), never in production logs.
        if (!answer.fit) log(`line check: unfit (${text.length} chars)${showText ? `: ${text}` : ''}`);
        return answer.fit;
      } catch (cause) {
        log(`line check: attempt ${attempt} failed after ${Date.now() - started} ms (${String(cause).slice(0, 80)})${attempt === 2 ? ', so the line is stopped' : ', trying once more'}`);
      }
    }
    return false;
  };
}

/** Is a finished painting fit to show? Fails closed (6 s), so a painting that can't be looked at is never shown. */
export function createPictureCheck(claude: Claude, timeoutMs = 6000) {
  return async (png: Buffer, description: string): Promise<boolean> => {
    try {
      const answer = await claude.ask({
        model: REACTOR,
        system: PICTURE,
        user: `The thing asked for: ${description}`,
        image: { mime: 'image/png', base64: png.toString('base64') },
        schema: FIT,
        parse: fitOnly,
        maxTokens: 50,
        timeoutMs,
        estimate: 'vision',
      });
      return answer.fit;
    } catch {
      return false;
    }
  };
}
