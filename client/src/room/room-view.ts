import { BackSide, BoxGeometry, Color, CustomBlending, DoubleSide, Mesh, MeshBasicMaterial, Object3D, OneFactor, OneMinusSrcAlphaFactor, PlaneGeometry, SphereGeometry, type Texture } from '@iwsdk/core';
import { prepareMap, stageLook } from '../paint/card-material.ts';
import type { TexRef } from '../paint/texref.ts';
import type { Vec3 } from '../stage/surface.ts';
import { roomLayout, type RoomSpec } from './room.ts';

/** One brightness for the whole painted room: the house lights. */
export const roomLook = { light: { value: 1 } };

export interface RoomView {
  root: Object3D;
  /** The painted table's top, where the book is placed. */
  tabletop: Object3D;
  /** Arranges the room around a seated reader. */
  place(head: Vec3, forward: Vec3, table: Vec3): void;
}

/** Room paint takes the stage's mood and the house lights, and never the lantern's pool. */
function roomMaterial(options: { ref?: TexRef; color?: string; side?: typeof DoubleSide | typeof BackSide; vertical?: boolean }): MeshBasicMaterial {
  const map: Texture | null = options.ref?.texture ?? null;
  // Cut-out paint is premultiplied (baked into KTX2, or on upload for PNG) and blends as such, like the cards.
  if (map) prepareMap(map, !options.ref!.baked);
  const material = new MeshBasicMaterial({
    map,
    color: new Color(options.color ?? '#ffffff'),
    side: options.side ?? DoubleSide,
    toneMapped: false,
    depthWrite: true,
    ...(map
      ? { transparent: true, alphaTest: 0.3, blending: CustomBlending, blendSrc: OneFactor, blendDst: OneMinusSrcAlphaFactor, blendSrcAlpha: OneFactor, blendDstAlpha: OneMinusSrcAlphaFactor }
      : {}),
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTint = stageLook.tint;
    shader.uniforms.uRoomLight = roomLook.light;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uTint;\nuniform float uRoomLight;')
      .replace('vec3 outgoingLight = reflectedLight.indirectDiffuse;', 'vec3 outgoingLight = reflectedLight.indirectDiffuse;\n\toutgoingLight *= uTint * uRoomLight;');
  };
  material.customProgramCacheKey = () => `room:${map ? 'map' : 'flat'}`;
  return material;
}

/** A plane showing exactly a piece of its texture. */
function piece(ref: TexRef, width: number, height: number): PlaneGeometry {
  const geometry = new PlaneGeometry(width, height);
  const uv = geometry.getAttribute('uv');
  const [u0, v0, u1, v1] = ref.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + (u1 - u0) * uv.getX(i), v0 + (v1 - v0) * uv.getY(i));
  return geometry;
}

/** The small painted reading room for no-passthrough mode: flats like a toy theater, a floor, a warm table. */
/** `shadow` is a soft round texture, so each flat and the table sit on the floor rather than float. */
export function buildRoom(spec: RoomSpec, textures: Map<string, TexRef>, base: string, shadow?: Texture): RoomView {
  const root = new Object3D();
  root.name = 'reading-room';
  const tex = (file: string): TexRef => {
    const ref = textures.get(`${base}/${file}`);
    if (!ref) throw new Error(`${base}/${file} was not loaded`);
    return ref;
  };

  // A deep evening wall all round, so the room never opens onto a void.
  const walls = new Mesh(new SphereGeometry(6, 32, 16), roomMaterial({ color: spec.wallColor, side: BackSide }));
  walls.name = 'walls';
  walls.renderOrder = -2000;
  root.add(walls);
  const floor = new Mesh(new PlaneGeometry(14, 14), roomMaterial({ color: spec.floorColor }));
  floor.name = 'floor';
  floor.rotation.x = -Math.PI / 2;
  root.add(floor);

  const flats = new Map<string, { mesh: Mesh; height: number; shadow: Mesh | null }>();
  const floorShadow = (width: number, depth: number): Mesh | null => {
    if (!shadow) return null;
    const mesh = new Mesh(new PlaneGeometry(width, depth), new MeshBasicMaterial({ map: shadow, transparent: true, depthWrite: false, opacity: 0.85, toneMapped: false }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = -1;
    root.add(mesh);
    return mesh;
  };
  for (const flat of spec.flats) {
    const ref = tex(flat.file);
    const width = flat.heightM * (ref.sizePx[0] / ref.sizePx[1]);
    const mesh = new Mesh(piece(ref, width, flat.heightM), roomMaterial({ ref }));
    mesh.name = flat.id;
    root.add(mesh);
    flats.set(flat.id, { mesh, height: flat.heightM, shadow: floorShadow(width * 1.15, 0.5) });
  }

  const tabletop = new Object3D();
  tabletop.name = 'tabletop';
  const topRef = tex(spec.tabletop.file);
  const [tw, td] = spec.tabletop.sizeM;
  const top = new Mesh(piece(topRef, tw, td), roomMaterial({ ref: topRef }));
  top.rotation.x = -Math.PI / 2;
  tabletop.add(top);
  // The table's front edge, so it reads as a table and not a mat.
  const edge = new Mesh(new PlaneGeometry(tw, 0.035), roomMaterial({ color: '#4A3526' }));
  edge.position.set(0, -0.0175, td / 2);
  tabletop.add(edge);
  // The table's body, down to the floor, so the table stands rather than floats.
  const body = new Mesh(new BoxGeometry(tw * 0.94, 1, td * 0.9), roomMaterial({ color: '#2E2119' }));
  body.name = 'table-body';
  root.add(body);
  const tableShadow = floorShadow(tw * 1.4, td * 1.4);
  root.add(tabletop);

  return {
    root,
    tabletop,
    place(head, forward, table) {
      for (const flat of roomLayout(spec, head, forward)) {
        const { mesh, height, shadow: under } = flats.get(flat.id)!;
        // Each flat stands on the floor, on its own soft shadow.
        mesh.position.set(flat.position.x, height / 2, flat.position.z);
        mesh.rotation.y = flat.yaw;
        if (under) {
          under.position.set(flat.position.x, 0.002, flat.position.z);
          under.rotation.z = flat.yaw;
        }
      }
      walls.position.set(head.x, 0, head.z);
      floor.position.set(head.x, 0, head.z);
      tabletop.position.set(table.x, table.y - 0.0005, table.z);
      tabletop.rotation.y = Math.atan2(head.x - table.x, head.z - table.z);
      const bodyHeight = Math.max(0.1, table.y - 0.04);
      body.scale.y = bodyHeight;
      body.position.set(table.x, bodyHeight / 2, table.z);
      body.rotation.y = tabletop.rotation.y;
      if (tableShadow) {
        tableShadow.position.set(table.x, 0.002, table.z);
        tableShadow.rotation.z = tabletop.rotation.y;
      }
    },
  };
}
