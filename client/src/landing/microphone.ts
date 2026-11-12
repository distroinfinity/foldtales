export type MicAnswer = 'granted' | 'denied';

/**
 * Asked on the landing page, because a first prompt inside XR ended the session (measured twice).
 * The stream only proves permission, so it closes at once. Speech is optional: any answer plays the show.
 */
export async function askForMicrophone(getUserMedia: ((c: MediaStreamConstraints) => Promise<MediaStream>) | undefined): Promise<MicAnswer> {
  if (!getUserMedia) return 'denied';
  try {
    const stream = await getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    for (const track of stream.getTracks()) track.stop();
    return 'granted';
  } catch {
    return 'denied';
  }
}
