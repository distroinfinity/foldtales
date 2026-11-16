import { runAsCaller } from '../src/guard.ts';

/** Runs `work` as a signed-in reader, as the guard would after checking the session. */
export const guardTestCaller = <T>(userId: string, work: () => Promise<T>): Promise<T> => runAsCaller({ deviceId: `device-${userId}`, userId }, work);
