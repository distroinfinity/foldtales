import { z } from 'zod';
import type { Vec3 } from '../stage/surface.ts';

/** `art/room/room.json`, as run 008 wrote it. */
export const RoomSpec = z.object({
  flats: z.array(z.object({ id: z.string(), file: z.string(), sizePx: z.tuple([z.number(), z.number()]), heightM: z.number().positive(), distanceM: z.number().positive(), azimuthDeg: z.number() })),
  tabletop: z.object({ file: z.string(), sizeM: z.tuple([z.number(), z.number()]), heightM: z.number().positive() }),
  floorColor: z.string(),
  wallColor: z.string(),
});
export type RoomSpec = z.infer<typeof RoomSpec>;

/** The table sits where a seated reader's table is: 0.42 m below the eyes, 0.45 m ahead. */
const TABLE_BELOW_M = 0.42;
const TABLE_AHEAD_M = 0.45;
/** House lights down in the painted room: about 75% darker, never black. */
const ROOM_DIM = 0.75;

const flat = (v: Vec3): { x: number; z: number } => {
  const length = Math.hypot(v.x, v.z) || 1;
  return { x: v.x / length, z: v.z / length };
};

export function tableSpot(head: Vec3, forward: Vec3): Vec3 {
  const f = flat(forward);
  return { x: head.x + f.x * TABLE_AHEAD_M, y: head.y - TABLE_BELOW_M, z: head.z + f.z * TABLE_AHEAD_M };
}

/** Each flat stands on the floor at its distance and angle around you, turned to face you. */
export function roomLayout(spec: RoomSpec, head: Vec3, forward: Vec3): Array<{ id: string; position: Vec3; yaw: number }> {
  const f = flat(forward);
  const ahead = Math.atan2(f.x, f.z);
  return spec.flats.map((flatSpec) => {
    const angle = ahead - (flatSpec.azimuthDeg * Math.PI) / 180;
    const position = { x: head.x + Math.sin(angle) * flatSpec.distanceM, y: 0, z: head.z + Math.cos(angle) * flatSpec.distanceM };
    return { id: flatSpec.id, position, yaw: Math.atan2(head.x - position.x, head.z - position.z) };
  });
}

/** How bright the painted room is as the house lights go down. */
export const roomLight = (dim: number): number => 1 - ROOM_DIM * Math.max(0, Math.min(1, dim));
