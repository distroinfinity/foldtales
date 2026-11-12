import { describe, expect, test } from 'vitest';
import { askForMicrophone } from '../client/src/landing/microphone.ts';

const stream = () => {
  const stopped: string[] = [];
  return { stopped, stream: { getTracks: () => [{ stop: () => stopped.push('a') }, { stop: () => stopped.push('b') }] } as unknown as MediaStream };
};

describe('the microphone request, before XR', () => {
  test('granted: the permission is kept and the check stream is closed at once', async () => {
    const s = stream();
    expect(await askForMicrophone(async () => s.stream)).toBe('granted');
    expect(s.stopped).toEqual(['a', 'b']);
  });

  test('denied: the show still plays, silently', async () => {
    expect(await askForMicrophone(async () => { throw new DOMException('no', 'NotAllowedError'); })).toBe('denied');
  });

  test('no microphone at all is the same as denied', async () => {
    expect(await askForMicrophone(undefined)).toBe('denied');
  });
});
