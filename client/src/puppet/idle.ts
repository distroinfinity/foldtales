export interface IdlePose {
  /** Clockwise degrees, as painted and approved. */
  rotationsDeg: Record<string, number>;
  breatheScaleY: number;
  face: 'forward' | 'blink';
  glowScale: number;
}

const POSES_PER_SECOND = 12;
const BLINK_EVERY_S = 4.1;
const BLINK_FOR_S = 0.17;

/** The approved idle: a slow sway, breathing, a tail flick, a lantern swing and a blink. */
export function idlePose(seconds: number): IdlePose {
  const t = Math.floor(seconds * POSES_PER_SECOND) / POSES_PER_SECOND;
  const sway = Math.sin(t * 1.1);
  return {
    rotationsDeg: {
      arm: 2 * sway,
      tail: 5 * Math.sin(t * 2.7),
      lantern: 2.2 * Math.sin(t * 2.2),
      head: 1.5 * sway,
    },
    breatheScaleY: 1 + 0.008 * Math.sin(t * 1.9),
    face: t % BLINK_EVERY_S < BLINK_FOR_S ? 'blink' : 'forward',
    glowScale: 1 + 0.05 * Math.sin(t * 7),
  };
}
