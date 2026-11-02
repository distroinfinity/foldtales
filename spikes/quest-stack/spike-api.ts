// Throwaway dev-server API: keeps the Anthropic key on the Mac, records what the headset reports.
import fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import type { Plugin } from 'vite';

const schema = {
  type: 'object', additionalProperties: false,
  required: ['label', 'alternatives', 'role', 'locomotion', 'confidence', 'joints', 'affordances', 'name', 'safe'],
  properties: {
    label: { type: 'string' }, alternatives: { type: 'array', items: { type: 'string' } },
    role: { type: 'string', enum: ['character', 'object', 'scenery'] },
    locomotion: { type: 'string', enum: ['walk', 'fly', 'slither', 'hop', 'roll', 'sail', 'sway', 'static'] },
    confidence: { type: 'number' },
    joints: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'part', 'x', 'y', 'parent'], properties: {
      id: { type: 'integer' }, part: { type: 'string', enum: ['root', 'spine', 'head', 'jaw', 'wing', 'arm', 'leg', 'tail', 'neck', 'other'] },
      x: { type: 'number' }, y: { type: 'number' }, parent: { type: 'integer' } } } },
    affordances: { type: 'array', items: { type: 'string', enum: ['carry', 'span_gap', 'climb', 'float', 'light', 'shelter', 'block', 'bounce', 'none'] } },
    name: { type: 'string' }, safe: { type: 'boolean' },
  },
} as const;

const system = `You read a hand-drawn doodle for a paper puppet theater. A person drew it quickly with a finger, so it is rough.
Judge the drawing on what it looks like.
label: the plain everyday noun for what it depicts (for example "dragon", "bridge", "hot air balloon"), one or two words. alternatives: 2 or 3 other plain nouns it could be.
role and locomotion: how it would move if it came alive. Things with wings or balloons fly. Animals with legs walk. Long legless bodies slither. Buildings, plants and tools are static or sway.
joints: a simple 2D puppet rig. x and y are 0 to 1 across the image, y down. Use 3 to 8 joints placed ON drawn lines. The root has parent -1 and sits at the center of the body. Limbs, wings and tails get a joint where they attach and one at the tip. Inanimate objects use a root and at most 2 more.
affordances: only what this thing would really let a small fox do.
name: a short fresh friendly name. safe: false only for sexual, hateful or violent imagery.`;

function body(req: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const parts: Buffer[] = [];
    req.on('data', (c: Buffer) => parts.push(c));
    req.on('end', () => resolve(Buffer.concat(parts)));
    req.on('error', reject);
  });
}

export function spikeApi(): Plugin {
  const log = new URL('./spike-telemetry.jsonl', import.meta.url).pathname;
  return {
    name: 'spike-api',
    configureServer(server) {
      server.middlewares.use('/api/telemetry', async (req, res) => {
        const raw = await body(req);
        fs.appendFileSync(log, `${raw.toString()}\n`);
        res.statusCode = 204;
        res.end();
      });
      server.middlewares.use('/api/mic', async (req, res) => {
        const raw = await body(req);
        fs.writeFileSync(new URL('./spike-mic.webm', import.meta.url).pathname, raw);
        fs.appendFileSync(log, `${JSON.stringify({ kind: 'mic-upload', bytes: raw.length })}\n`);
        res.statusCode = 204;
        res.end();
      });
      server.middlewares.use('/api/doodle', async (req, res) => {
        const data = (await body(req)).toString();
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        try {
          const client = new Anthropic({ maxRetries: 0 });
          const stream = client.messages.stream({
            model: 'claude-haiku-5-5', max_tokens: 1200,
            system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
            thinking: { type: 'disabled' },
            output_config: { effort: 'low', format: { type: 'json_schema', schema } },
            messages: [{ role: 'user', content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data } },
              { type: 'text', text: 'Read this doodle.' },
            ] }],
          } as never);
          stream.on('text', (delta: string) => res.write(delta));
          await stream.finalMessage();
        } catch (error) {
          fs.appendFileSync(log, `${JSON.stringify({ kind: 'doodle-error', error: String(error).slice(0, 300) })}\n`);
        }
        res.end();
      });
    },
  };
}
