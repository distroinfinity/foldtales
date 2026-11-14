import { z } from 'zod';
import { REACTOR, type Claude } from '../director/claude.ts';

/** Is what the reader said fit to steer a cozy, PG storybook? Runs alongside the turn; anything unclear counts as fine. */
export function createModerator(claude: Claude) {
  const schema = { type: 'object', additionalProperties: false, required: ['fit'], properties: { fit: { type: 'boolean' } } };
  return async (text: string): Promise<boolean> => {
    try {
      const answer = await claude.ask({
        model: REACTOR,
        system:
          'You check what a reader says out loud to the characters of a cozy, PG bedtime storybook for teens and adults. Answer fit=false only for sexual content, graphic violence or gore, slurs or hate, self-harm, or real-world harmful instructions. Silly, rude-but-mild, scary-but-gentle, sad or odd is fit=true.',
        user: text,
        schema,
        parse: z.object({ fit: z.boolean() }),
        maxTokens: 50,
        timeoutMs: 4000,
      });
      return answer.fit;
    } catch {
      return true;
    }
  };
}
