import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { TAG_VOCABULARY, type ObjectDef, type PaintRequest, type PaintResult } from '@tabletop/contracts';
import { z } from 'zod';
import { REACTOR, type Claude } from '../director/claude.ts';
import { cutOut } from './cutout.ts';
import type { Stories } from './stories.ts';

/**
 * The live painter: something new the story needs, painted in the book's object style (run 013's
 * recipe), cut out, named and tagged, about 30 s. A job, so no request waits on it. Capped per
 * evening and in total; anything that fails its checks is "couldn't find it", never shown.
 */

const API = 'https://api.dev.runwayml.com/v1';
const MODEL = 'seedream5_flash';
const JOB_TTL_MS = 10 * 60_000;

const template = (thing: string) =>
  `Paint one new thing in exactly the painting style of Figure 1, as a single separate storybook object: ${thing}. The object alone, centered, upright, about half the height of the image. Leave a wide margin of empty paper on all four sides, with nothing touching the edge of the image. Its silhouette has a clean hard edge traced with a fine graphite pencil outline. No cast shadows on the paper. Hand-painted traditional watercolor with a fine graphite pencil outline, from a vintage natural history picture book. Soft pigment washes, visible paper grain, gentle edges. Natural, believable, not a cartoon. On plain flat solid vivid magenta paper, one even color. No pink or purple on the object. No scenery, no text, no kite.`;

const Named = z.object({
  name: z.string().min(1).transform((s) => s.slice(0, 40)),
  description: z.string().min(1).transform((s) => s.slice(0, 160)),
  tags: z.array(z.string()).transform((t) => t.slice(0, 4)),
  size: z.enum(['tiny', 'small', 'medium', 'large']),
  /** The thing to paint, in plain words, as it looks. */
  paint: z.string().min(1).transform((s) => s.slice(0, 300)),
  fit: z.boolean(),
});

const HEIGHT_M = { tiny: 0.045, small: 0.065, medium: 0.085, large: 0.11 } as const;

export interface PainterDeps {
  runwayKey: string | undefined;
  claude: Claude | null;
  /** The style reference, Figure 1 (run 013). */
  styleRefPath: string;
  /** Jobs, per-story and per-reader limits, and the lifetime credit pool, kept in the database. */
  stories: Pick<Stories, 'claimPaint' | 'refundPaint' | 'paintArrived'>;
  /** The look check on the finished picture. Fails closed. Painting never ships without it. */
  checkPicture: (png: Buffer, description: string) => Promise<boolean>;
  /** The check on the painting's generated name, before it can reach a saved page. Fails closed. */
  checkLine: (text: string) => Promise<boolean>;
  /** Live painting is switched on (TT_PAINTING=on). */
  enabled: () => boolean;
  log?: (m: string) => void;
}

export function createPainter(deps: PainterDeps) {
  const jobs = new Map<string, { result: PaintResult; at: number }>();
  let styleRef: string | null = null;
  const ref = () => (styleRef ??= `data:image/png;base64,${readFileSync(deps.styleRefPath).toString('base64')}`);
  const headers = () => ({ Authorization: `Bearer ${deps.runwayKey}`, 'X-Runway-Version': '2024-11-06', 'Content-Type': 'application/json' });

  async function name(request: PaintRequest): Promise<z.infer<typeof Named>> {
    if (!deps.claude) throw new Error('no claude');
    const tags = TAG_VOCABULARY.map((t) => `${t.id} (${t.meaning})`).join('; ');
    const schema = {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'description', 'tags', 'size', 'paint', 'fit'],
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        tags: { type: 'array', items: { type: 'string', enum: TAG_VOCABULARY.map((t) => t.id) } },
        size: { type: 'string', enum: ['tiny', 'small', 'medium', 'large'] },
        paint: { type: 'string' },
        fit: { type: 'boolean' },
      },
    };
    const content = request.image
      ? `The reader showed the storybook's characters a real thing (photo attached). Name it as a storybook object, as the characters would see it (it belongs to the Giant, the reader). Describe it for a painter in plain words: its shape, colours, material. Story note: ${request.description}`
      : `A storybook needs this thing painted: ${request.description}. Name it and describe it for a painter in plain words: its shape, colours, material.`;
    return deps.claude.ask({
      model: REACTOR,
      system: `You name and tag objects for a cozy, PG painted storybook. Tags only from this list: ${tags}. size is how big it is next to a small fox (tiny: a key; small: a mug; medium: a teapot; large: a kite). fit is false only if it's unsafe or unsuitable for a cozy PG book (weapons, gore, anything adult).`,
      user: content,
      image: request.image ?? undefined,
      schema,
      parse: Named,
      maxTokens: 400,
      timeoutMs: 8000,
      estimate: 'name',
    });
  }

  /** `job.charged` turns true once Runway has accepted the job (its credits are really spent then). */
  async function paint(thing: string, job: { charged: boolean }): Promise<Buffer> {
    const r = await fetch(`${API}/text_to_image`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ model: MODEL, ratio: '1024:1024', promptText: template(thing), referenceImages: [{ uri: ref() }] }),
    });
    const made = (await r.json()) as { id?: string };
    if (!r.ok || !made.id) throw new Error(`runway refused (${r.status})`);
    job.charged = true;
    for (let i = 0; i < 30; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      const task = (await fetch(`${API}/tasks/${made.id}`, { headers: headers() }).then((x) => x.json()).catch(() => ({ status: 'UNKNOWN' }))) as { status: string; output?: string[] };
      if (task.status === 'SUCCEEDED' && task.output?.[0]) return Buffer.from(await (await fetch(task.output[0])).arrayBuffer());
      if (task.status === 'FAILED' || task.status === 'CANCELLED') throw new Error(`runway ${task.status.toLowerCase()}`);
    }
    throw new Error('runway took too long');
  }

  async function run(jobId: string, request: PaintRequest, objectId: string | null): Promise<void> {
    const started = Date.now();
    const job = { charged: false };
    try {
      const named = await name(request);
      if (!named.fit) throw new Error('not for this book');
      if (!(await deps.checkLine(named.name))) throw new Error('its name failed the check');
      const image = await paint(named.paint, job);
      const cut = await cutOut(image);
      if (!cut.ok) throw new Error(cut.reason);
      // Fail closed: a picture that isn't checked is never shown.
      if (!(await deps.checkPicture(cut.cutout.png, request.description))) throw new Error('it failed the look check');
      const id = objectId ?? `live-${jobId.slice(-8)}`;
      const known = [...new Set(named.tags)].filter((t) => TAG_VOCABULARY.some((v) => v.id === t)).slice(0, 4);
      const def: ObjectDef = {
        id,
        name: named.name.toLowerCase(),
        description: named.description,
        tags: known.length ? known : ['lightweight'],
        art: { kind: 'url', url: `data:image/png;base64,${cut.cutout.png.toString('base64')}` },
        size: { heightM: HEIGHT_M[named.size] },
        pivot: [50, 96],
        provenance: 'live',
      };
      jobs.set(jobId, { result: { status: 'done', object: def }, at: Date.now() });
      deps.stories.paintArrived(jobId, def.name);
      deps.log?.(`painted "${named.name}" in ${Date.now() - started} ms`);
    } catch (cause) {
      // Never reached Runway (or it refused): the reserved credits go back to the pool.
      if (!job.charged) deps.stories.refundPaint(jobId);
      deps.log?.(`painting failed after ${Date.now() - started} ms: ${String(cause)}`);
      jobs.set(jobId, { result: { status: 'failed', reason: String(cause).slice(0, 120) }, at: Date.now() });
    }
  }

  const prune = () => {
    const now = Date.now();
    for (const [id, j] of jobs) if (now - j.at > JOB_TTL_MS) jobs.delete(id);
  };

  return {
    /**
     * Starts a painting for (story, object), or hands back the job already started for it. Null when
     * painting is off or this story, this reader or the credit pool has none left.
     */
    start(userId: string, request: PaintRequest): string | null {
      prune();
      if (!deps.enabled() || !deps.runwayKey || !deps.claude) return null;
      let claim: { jobId: string; fresh: boolean };
      try {
        claim = deps.stories.claimPaint(userId, request.storyId, request.objectId);
      } catch {
        return null;
      }
      if (claim.fresh) {
        jobs.set(claim.jobId, { result: { status: 'pending' }, at: Date.now() });
        void run(claim.jobId, request, request.objectId);
      }
      return claim.jobId;
    },
    result(jobId: string): PaintResult {
      return jobs.get(jobId)?.result ?? { status: 'failed', reason: 'no such painting' };
    },
  };
}
export type Painter = ReturnType<typeof createPainter>;
