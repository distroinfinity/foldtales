import { CustomBlending, DoubleSide, Group, LinearFilter, LinearMipmapLinearFilter, Mesh, MeshBasicMaterial, OneFactor, OneMinusSrcAlphaFactor, PlaneGeometry, SRGBColorSpace, TextureLoader, type Texture } from '@iwsdk/core';
import { Rig } from '@tabletop/contracts';
import { idlePose } from './idle.ts';
import { layoutCards, metresPerPixel } from './layout.ts';
import { radialTexture, softPlane } from './soft-sprites.ts';

export interface StageConfig {
  cast: string;
  heightM: number;
  glow: { x: number; y: number; sizePx: number };
  shadow: { widthM: number; depthM: number };
}

export interface Puppet {
  root: Group;
  update(seconds: number): void;
}

export interface PuppetDeps {
  json(url: string): Promise<unknown>;
  texture(url: string): Promise<Texture>;
}

const FACES = ['forward', 'blink'] as const;
const ANISOTROPY = 4;
const SHADOW_LIFT_M = 0.001;

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.json();
}

const browserDeps: PuppetDeps = {
  json: fetchJson,
  texture: (url) => new TextureLoader().loadAsync(url),
};

/**
 * The painted edges fade over many pixels, so they're blended, not cut. The texture is
 * premultiplied so the paper colour hidden under transparent pixels can't bleed into an
 * edge when it's filtered. The alphaTest drops the faintest edge pixels, which carry the
 * paper's tint as a pale rim, and keeps empty margins out of the depth buffer.
 */
export function cardMaterial(map: Texture): MeshBasicMaterial {
  map.colorSpace = SRGBColorSpace;
  map.premultiplyAlpha = true;
  map.generateMipmaps = true;
  map.minFilter = LinearMipmapLinearFilter;
  map.magFilter = LinearFilter;
  map.anisotropy = ANISOTROPY;
  return new MeshBasicMaterial({
    map,
    transparent: true,
    alphaTest: 0.25,
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor,
    blendSrcAlpha: OneFactor,
    blendDstAlpha: OneMinusSrcAlphaFactor,
    side: DoubleSide,
    toneMapped: false,
  });
}

function textureSize(texture: Texture): [number, number] {
  const image = texture.image as { width: number; height: number };
  return [image.width, image.height];
}

const toRotationZ = (clockwiseDeg: number): number => (-clockwiseDeg * Math.PI) / 180;

/** Rejects if any file is missing, so a half-built puppet never reaches the table. */
export async function loadPuppet(base: string, stage: StageConfig, deps: PuppetDeps = browserDeps): Promise<Puppet> {
  const rig = Rig.parse(await deps.json(`${base}/rig.json`));
  const files: Array<[string, string]> = Object.entries(rig.parts).map(([name, part]) => [name, part.file]);
  if (rig.head) for (const face of FACES) files.push([`head:${face}`, rig.head.files.replace('<name>', face)]);
  const textures = new Map(await Promise.all(files.map(async ([name, file]) => [name, await deps.texture(`${base}/${file}`)] as const)));

  const sizes = Object.fromEntries([...textures].map(([name, texture]) => [name, textureSize(texture)]));
  const root = new Group();
  root.name = 'puppet';
  const groups = new Map<string, Group>();
  for (const card of layoutCards(rig, sizes, stage.heightM)) {
    const group = new Group();
    group.name = card.name;
    group.position.set(...card.pivot);
    const mesh = new Mesh(new PlaneGeometry(...card.size), cardMaterial(textures.get(card.name)!));
    mesh.position.set(card.anchor[0], card.anchor[1], 0);
    // Blended cards draw back to front in the rig's own layer order.
    mesh.renderOrder = card.pivot[2] * 1000;
    group.add(mesh);
    root.add(group);
    groups.set(card.name, group);
  }

  const m = metresPerPixel(rig, stage.heightM);

  const shadow = softPlane(radialTexture([[0, 'rgba(10,8,12,.55)'], [0.7, 'rgba(10,8,12,0)']]), stage.shadow.widthM, stage.shadow.depthM);
  shadow.name = 'contact-shadow';
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = SHADOW_LIFT_M;
  shadow.renderOrder = -1;
  root.add(shadow);

  if (rig.chinShadow) {
    const { x, y, width, height, z } = rig.chinShadow;
    const chin = softPlane(radialTexture([[0, 'rgba(38,26,34,.5)'], [0.45, 'rgba(38,26,34,.28)'], [0.72, 'rgba(38,26,34,0)']]), width * m, height * m);
    chin.name = 'chin-shadow';
    chin.position.set((x + width / 2) * m, -(y + height / 2) * m, z * 0.001);
    chin.renderOrder = z;
    root.add(chin);
  }

  const glowSize = stage.glow.sizePx * m;
  const glow = softPlane(radialTexture([[0, 'rgba(255,214,130,.35)'], [0.45, 'rgba(255,214,130,.12)'], [0.7, 'rgba(255,214,130,0)']]), glowSize, glowSize);
  glow.name = 'lantern-glow';
  glow.position.set(stage.glow.x * m, -stage.glow.y * m, 0.009);
  glow.renderOrder = 100;
  root.add(glow);

  const set = (name: string, deg: number): void => {
    const group = groups.get(name);
    if (group) group.rotation.z = toRotationZ(deg);
  };

  return {
    root,
    update(seconds) {
      const pose = idlePose(seconds);
      for (const [name, deg] of Object.entries(pose.rotationsDeg)) {
        if (name === 'head') for (const face of FACES) set(`head:${face}`, deg);
        else set(name, deg);
      }
      const coat = groups.get('coat');
      if (coat) coat.scale.y = pose.breatheScaleY;
      for (const face of FACES) {
        const group = groups.get(`head:${face}`);
        if (group) group.visible = face === pose.face;
      }
      glow.scale.setScalar(pose.glowScale);
    },
  };
}
