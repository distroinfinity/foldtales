import { AdditiveBlending, DoubleSide, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, TextureLoader, Vector3, type Texture } from '@iwsdk/core';
import { Rig } from '@tabletop/contracts';
import type { CastEntry } from '../show/manifest.ts';
import type { Pose } from './acting.ts';
import { layoutCards, metresPerPixel, type CardLayout } from './layout.ts';
import { cardMaterial } from '../paint/card-material.ts';
import { wholeRef, type TexRef } from '../paint/texref.ts';

/** The soft, painted-light pieces every puppet shares. Made once by the caller (they need a canvas). */
export interface PuppetFx {
  shadow: Texture;
  glow: Texture;
  chin: Texture;
  smoke: TexRef | null;
}

export interface PuppetState {
  /** How far the card stands: 0 flat on the page, 1 upright. */
  stand: number;
  /** A carried light's glow, 0 when it's out. */
  glow: number;
  /** Smoke rising from a light that just went out, 0 to 1. */
  smoke: number;
}

export interface PuppetView {
  /** Stands on the mark. Not a Group: it draws at its mount's place in the stack (Three resets order at every Group). */
  root: Object3D;
  /** Turns about the feet to fold the character flat with the page. */
  fold: Object3D;
  /** Turns the character toward you, within a limit. */
  yaw: Object3D;
  body: Object3D;
  apply(pose: Pose, state: PuppetState): void;
  setVariant(part: string, state: string): void;
  /** Shows or hides a part and everything on it, such as a carried light that has been dropped. */
  setPartVisible(part: string, visible: boolean): void;
  /** Where a carried light's glow is, in world space. Null without a light. */
  lightWorldPosition(target: Vector3): Vector3 | null;
  /** The point the paw holds things at, moving with the arm. Null for a character that can't hold. */
  grip: Object3D | null;
  /** A small lift for the whole card, such as a flier's height or a kite's pull. Metres. */
  lift: Object3D;
}

export interface PuppetDeps {
  json(url: string): Promise<unknown>;
  texture(url: string): Promise<Texture>;
}

const SHADOW_LIFT_M = 0.0008;
const GLOW_OPACITY = 0.55;
const SMOKE_HEIGHT_M = 0.045;
const SMOKE_RISE_M = 0.035;

const toRotationZ = (clockwiseDeg: number): number => (-clockwiseDeg * Math.PI) / 180;

function softPlane(map: Texture, width: number, height: number, additive = false): Mesh {
  const material = new MeshBasicMaterial({ map, transparent: true, depthWrite: false, side: DoubleSide, toneMapped: false, ...(additive ? { blending: AdditiveBlending } : {}) });
  return new Mesh(new PlaneGeometry(width, height), material);
}

/** A card's quad, showing exactly its piece of the texture (a whole PNG, or an atlas rectangle). */
function cardGeometry(width: number, height: number, ref: TexRef): PlaneGeometry {
  const geometry = new PlaneGeometry(width, height);
  const uv = geometry.getAttribute('uv');
  const [u0, v0, u1, v1] = ref.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + (u1 - u0) * uv.getX(i), v0 + (v1 - v0) * uv.getY(i));
  uv.needsUpdate = true;
  return geometry;
}

/** Every file a character needs: its parts, every head, and every variant. */
export function puppetFiles(entry: CastEntry, rig: Rig): string[] {
  const files = Object.values(rig.parts).map((part) => part.file);
  if (rig.head) for (const face of Object.keys(rig.head.offsets)) files.push(rig.head.files.replace('<name>', face));
  for (const variants of Object.values(entry.variants)) files.push(...Object.values(variants));
  return [...new Set(files)];
}

export function buildPuppet(entry: CastEntry, rig: Rig, textures: Map<string, TexRef>, fx: PuppetFx): PuppetView {
  const { member } = entry;
  const m = metresPerPixel(rig, member.heightM);
  const px = (x: number, y: number): [number, number] => [x * m, -y * m];
  const material = (ref: TexRef) => cardMaterial(ref.texture, { doubleSided: true, baked: ref.baked });

  const root = new Object3D();
  root.name = member.id;
  const fold = new Object3D();
  fold.name = 'fold';
  const yaw = new Object3D();
  yaw.name = 'yaw';
  const body = new Object3D();
  body.name = 'puppet-body';
  if (entry.flip) body.scale.x = -1;
  const lift = new Object3D();
  lift.name = 'lift';
  root.add(lift);
  lift.add(fold);
  fold.add(yaw);
  yaw.add(body);

  const sizes: Record<string, [number, number]> = {};
  const fileOf: Record<string, string> = {};
  for (const [name, part] of Object.entries(rig.parts)) fileOf[name] = part.file;
  if (rig.head) for (const face of Object.keys(rig.head.offsets)) fileOf[`head:${face}`] = rig.head.files.replace('<name>', face);
  for (const [name, file] of Object.entries(fileOf)) {
    const ref = textures.get(file);
    if (!ref) throw new Error(`${member.id}: ${file} was not loaded`);
    sizes[name] = ref.sizePx;
  }

  const pivots = new Map<string, Object3D[]>();
  const variantMeshes = new Map<string, Map<string, Mesh>>();
  const layouts = new Map<string, CardLayout>();

  const makeCard = (card: CardLayout, file: string, name: string): Mesh => {
    const ref = textures.get(file)!;
    const mesh = new Mesh(cardGeometry(card.size[0], card.size[1], ref), material(ref));
    mesh.name = name;
    mesh.position.set(card.anchor[0], card.anchor[1], 0);
    // Blended cards draw back to front in the rig's own layer order.
    mesh.renderOrder = Math.round(card.pivot[2] * 1000);
    return mesh;
  };

  for (const card of layoutCards(rig, sizes, member.heightM)) {
    layouts.set(card.name, card);
    const sides = card.mirrored ? [1, -1] : [1];
    for (const side of sides) {
      const pivot = new Object3D();
      pivot.name = side === 1 ? card.name : `${card.name}~mirror`;
      pivot.position.set(...card.pivot);
      pivot.rotation.z = toRotationZ(card.baseDeg);
      const base = makeCard(card, card.file, `${card.name}#base`);
      pivot.add(base);
      const variants = new Map<string, Mesh>([['base', base]]);
      for (const [state, file] of Object.entries(entry.variants[card.name] ?? {})) {
        const mesh = makeCard(card, file, `${card.name}#${state}`);
        mesh.visible = false;
        pivot.add(mesh);
        variants.set(state, mesh);
      }
      if (side === 1) variantMeshes.set(card.name, variants);
      if (side === -1) {
        const mirror = new Object3D();
        mirror.name = `${card.name}~mirror-side`;
        mirror.scale.x = -1;
        mirror.add(pivot);
        body.add(mirror);
      } else {
        body.add(pivot);
      }
      pivots.set(card.name, [...(pivots.get(card.name) ?? []), pivot]);
    }
  }

  const shadow = softPlane(fx.shadow, entry.shadow.widthM, entry.shadow.depthM);
  shadow.name = 'contact-shadow';
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = SHADOW_LIFT_M;
  shadow.renderOrder = -1;
  root.add(shadow);

  if (rig.chinShadow) {
    const { x, y, width, height, z } = rig.chinShadow;
    const chin = softPlane(fx.chin, width * m, height * m);
    chin.name = 'chin-shadow';
    chin.position.set(...px(x + width / 2, y + height / 2), z * 0.001);
    chin.renderOrder = z;
    body.add(chin);
  }

  let glow: Mesh | null = null;
  let smoke: Mesh | null = null;
  let smokeBase: Vector3 | null = null;
  const light = entry.light;
  if (light) {
    const lightPivot = pivots.get(light.part)?.[0];
    const card = layouts.get(light.part);
    if (!lightPivot || !card) throw new Error(`${member.id}: the light's part ${light.part} is not in the rig`);
    const size = light.glowSizePx * m;
    glow = softPlane(fx.glow, size, size, true);
    glow.name = 'carried-glow';
    const [gx, gy] = px(...light.glowAt);
    glow.position.set(gx - card.pivot[0], gy - card.pivot[1], 0.002);
    glow.renderOrder = 100;
    lightPivot.add(glow);
    if (fx.smoke) {
      const aspect = fx.smoke.sizePx[0] / fx.smoke.sizePx[1];
      smoke = new Mesh(cardGeometry(SMOKE_HEIGHT_M * aspect, SMOKE_HEIGHT_M, fx.smoke), material(fx.smoke));
      smoke.name = 'smoke';
      const [sx, sy] = px(...light.smokeFrom);
      smokeBase = new Vector3(sx, sy + SMOKE_HEIGHT_M / 2, 0.004);
      smoke.renderOrder = 101;
      smoke.visible = false;
      body.add(smoke);
    }
  }

  let grip: Object3D | null = null;
  const gripSpec = member.anatomy.grip;
  if (gripSpec) {
    const gripPivot = pivots.get(gripSpec.part)?.[0];
    const card = layouts.get(gripSpec.part);
    if (gripPivot && card) {
      grip = new Object3D();
      grip.name = 'grip';
      const [w, h] = card.size;
      grip.position.set(card.anchor[0] - w / 2 + (w * gripSpec.at[0]) / 100, card.anchor[1] + h / 2 - (h * gripSpec.at[1]) / 100, 0.003);
      gripPivot.add(grip);
    }
  }

  const heads = rig.head ? Object.keys(rig.head.offsets) : [];
  const headPivots = heads.map((face) => pivots.get(`head:${face}`)?.[0]).filter((p): p is Object3D => !!p);
  const headRest = new Map(headPivots.map((p) => [p, p.position.clone()]));
  const restOf = new Map<Object3D, { position: Vector3; rotation: number }>();
  for (const list of pivots.values()) for (const p of list) restOf.set(p, { position: p.position.clone(), rotation: p.rotation.z });
  const glowWorld = new Vector3();

  return {
    root,
    fold,
    yaw,
    body,
    apply(pose, state) {
      for (const [name, partPose] of Object.entries(pose.parts)) {
        for (const pivot of pivots.get(name) ?? []) {
          const rest = restOf.get(pivot)!;
          pivot.rotation.z = rest.rotation + toRotationZ(partPose.deg);
          pivot.position.set(rest.position.x + partPose.px[0] * m, rest.position.y - partPose.px[1] * m, rest.position.z);
          pivot.scale.set(partPose.scaleX, partPose.scaleY, 1);
        }
      }
      for (const pivot of headPivots) {
        const rest = headRest.get(pivot)!;
        pivot.visible = pivot.name === `head:${pose.face}`;
        pivot.rotation.z = toRotationZ(pose.headDeg);
        pivot.position.set(rest.x + pose.headPx[0] * m, rest.y - pose.headPx[1] * m, rest.z);
      }
      body.position.set(pose.bodyPx[0] * m * (entry.flip ? -1 : 1), -pose.bodyPx[1] * m, 0);
      body.scale.y = pose.bodyScaleY;
      if (glow) {
        glow.visible = state.glow > 0.001;
        (glow.material as MeshBasicMaterial).opacity = GLOW_OPACITY * state.glow * pose.glow;
        glow.scale.setScalar(0.94 + 0.06 * pose.glow);
      }
      if (smoke && smokeBase) {
        smoke.visible = state.smoke > 0 && state.smoke < 1;
        smoke.position.set(smokeBase.x, smokeBase.y + state.smoke * SMOKE_RISE_M, smokeBase.z);
        smoke.scale.setScalar(0.7 + state.smoke * 0.5);
        const fade = state.smoke < 0.15 ? state.smoke / 0.15 : 1 - (state.smoke - 0.15) / 0.85;
        (smoke.material as MeshBasicMaterial).opacity = Math.max(0, fade);
      }
      (shadow.material as MeshBasicMaterial).opacity = Math.max(0, Math.min(1, state.stand));
    },
    setVariant(part, wanted) {
      const variants = variantMeshes.get(part);
      if (!variants) return;
      const chosen = variants.has(wanted) ? wanted : 'base';
      for (const [state, mesh] of variants) mesh.visible = state === chosen;
    },
    grip,
    lift,
    setPartVisible(part, visible) {
      for (const pivot of pivots.get(part) ?? []) pivot.visible = visible;
    },
    lightWorldPosition(target) {
      if (!glow) return null;
      return glow.getWorldPosition(target ?? glowWorld);
    },
  };
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.json();
}

export const browserDeps: PuppetDeps = {
  json: fetchJson,
  texture: (url) => new TextureLoader().loadAsync(url),
};

/** Rejects if any file is missing, so a half-built puppet never reaches the table. */
export async function loadPuppet(entry: CastEntry, base: string, fx: PuppetFx, deps: PuppetDeps = browserDeps): Promise<PuppetView> {
  const rig = Rig.parse(await deps.json(`${base}/${entry.member.rig}/rig.json`));
  const files = puppetFiles(entry, rig);
  const textures = new Map(await Promise.all(files.map(async (file) => [file, wholeRef(await deps.texture(`${base}/${entry.member.rig}/${file}`))] as const)));
  return buildPuppet(entry, rig, textures, fx);
}
