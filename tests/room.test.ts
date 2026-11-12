import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { CustomBlending, OneFactor, OneMinusSrcAlphaFactor, Texture, type Mesh, type MeshBasicMaterial } from '@iwsdk/core';
import { RoomSpec, roomLayout, tableSpot, roomLight } from '../client/src/room/room.ts';
import { buildRoom } from '../client/src/room/room-view.ts';
import { wholeRef } from '../client/src/paint/texref.ts';

const spec = RoomSpec.parse(JSON.parse(readFileSync(new URL('../art/room/room.json', import.meta.url), 'utf8')));
const head = { x: 0, y: 1.15, z: 0 };
const forward = { x: 0, y: 0, z: -1 };

describe('the painted reading room', () => {
  test('its spec parses and every file exists', () => {
    for (const flat of spec.flats) expect(existsSync(new URL(`../art/room/${flat.file}`, import.meta.url)), flat.file).toBe(true);
    expect(existsSync(new URL(`../art/room/${spec.tabletop.file}`, import.meta.url))).toBe(true);
  });

  test('the table is in front of you at a seated reading height, within reach', () => {
    const spot = tableSpot(head, forward);
    expect(spot.y).toBeCloseTo(head.y - 0.42, 5);
    const reach = Math.hypot(spot.x - head.x, spot.z - head.z);
    expect(reach).toBeGreaterThan(0.3);
    expect(reach).toBeLessThan(0.6);
  });

  test('the flats stand around you on the floor, each facing you', () => {
    const layout = roomLayout(spec, head, forward);
    for (const flat of layout) {
      expect(flat.position.y).toBeCloseTo(0, 5);
      const toYou = Math.atan2(head.x - flat.position.x, head.z - flat.position.z);
      expect(Math.abs(Math.atan2(Math.sin(toYou - flat.yaw), Math.cos(toYou - flat.yaw)))).toBeLessThan(1e-6);
    }
    const middle = layout.find((f) => f.id === 'flat-shelves')!;
    expect(middle.position.z).toBeLessThan(-1.5);
  });

  test('house lights down dims the painted room itself, never to black', () => {
    expect(roomLight(0)).toBe(1);
    expect(roomLight(1)).toBeGreaterThan(0.15);
    expect(roomLight(1)).toBeLessThan(0.4);
  });

  test('the room builds one card per flat, plus the tabletop, floor and walls', () => {
    const textures = new Map([...spec.flats.map((f) => f.file), spec.tabletop.file].map((f) => {
      const t = new Texture();
      t.image = { width: 1000, height: 2000 };
      return [`room/${f}`, wholeRef(t)];
    }));
    const room = buildRoom(spec, textures, 'room');
    for (const flat of spec.flats) expect(room.root.getObjectByName(flat.id)).toBeDefined();
    expect(room.root.getObjectByName('tabletop')).toBeDefined();
    expect(room.root.getObjectByName('floor')).toBeDefined();
    expect(room.root.getObjectByName('walls')).toBeDefined();
  });

  test('flats blend as premultiplied, the same whether the art arrived as KTX2 or PNG, so cut edges never darken', () => {
    for (const baked of [true, false]) {
      const textures = new Map([...spec.flats.map((f) => f.file), spec.tabletop.file].map((f) => {
        const t = new Texture();
        t.image = { width: 1000, height: 2000 };
        return [`room/${f}`, { ...wholeRef(t), baked }];
      }));
      const room = buildRoom(spec, textures, 'room');
      const material = (room.root.getObjectByName(spec.flats[0]!.id) as Mesh).material as MeshBasicMaterial;
      expect(material.blending).toBe(CustomBlending);
      expect([material.blendSrc, material.blendDst]).toEqual([OneFactor, OneMinusSrcAlphaFactor]);
      expect(material.map!.premultiplyAlpha).toBe(!baked);
    }
  });
});
