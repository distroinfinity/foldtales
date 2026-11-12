/**
 * The turn (radians, about up) that faces a point at (dx, dz) from the character, where +z is
 * straight toward the reader. Clamped, so a card never shows its edge.
 */
export function yawToward(dx: number, dz: number, limitDeg: number): number {
  const limit = (limitDeg * Math.PI) / 180;
  return Math.max(-limit, Math.min(limit, Math.atan2(dx, dz)));
}
