import { parentPort } from 'node:worker_threads';
import { encodeKtx2 } from './ktx2-encode.ts';

/** One encode at a time, in its own thread: the encoder is single-threaded, so the build runs several. */
parentPort!.on('message', async (job: { id: number; rgba: Uint8Array; width: number; height: number; hasAlpha: boolean }) => {
  try {
    // A copy, so transferring it can never detach memory the encoder still owns.
    const bytes = (await encodeKtx2(job.rgba, job.width, job.height, job.hasAlpha)).slice();
    parentPort!.postMessage({ id: job.id, bytes }, [bytes.buffer as ArrayBuffer]);
  } catch (cause) {
    parentPort!.postMessage({ id: job.id, error: String(cause) });
  }
});
