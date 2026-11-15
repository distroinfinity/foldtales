import {
  Color,
  CustomBlending,
  DoubleSide,
  FrontSide,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshBasicMaterial,
  NoBlending,
  OneFactor,
  OneMinusSrcAlphaFactor,
  SRGBColorSpace,
  Vector3,
  type Texture,
} from '@iwsdk/core';

/**
 * One set of values across the whole stage: the mood tint, and the pool of light a carried
 * lantern throws on the paper around it. Every card material points at these same objects.
 */
export const stageLook = {
  tint: { value: new Color(1, 1, 1) },
  poolPos: { value: new Vector3(0, -100, 0) },
  poolRadius: { value: 0.1 },
  poolStrength: { value: 0 },
  poolColor: { value: new Color(1, 0.74, 0.42) },
  pageColor: { value: new Color('#F6EFE2') },
  /** 1 while the cast is drawn as dark silhouettes, for their shadows on your wall. */
  silhouette: { value: 0 },
};

export type MaterialConfig = 'blend' | 'coverage';

let defaultConfig: MaterialConfig = 'blend';
/** Chooses the edge treatment for every card built after this call. */
export function useMaterialConfig(config: MaterialConfig): void {
  defaultConfig = config;
}

export interface CardOptions {
  /** `back` is plain page-coloured card in the art's outline, as pop-up layers have. */
  face?: 'front' | 'back';
  config?: MaterialConfig;
  /** Whether the lantern's pool of light reaches this card. */
  pool?: boolean;
  doubleSided?: boolean;
  /** Opaque painted paper with no cut edge, such as the printed ground. */
  solid?: boolean;
  /** The texture's alpha is already premultiplied (a KTX2 build), so upload must not do it again. */
  baked?: boolean;
}

const ANISOTROPY = 4;

export function prepareMap(map: Texture, premultiply: boolean): void {
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = ANISOTROPY;
  // A KTX2 texture carries its own mips, and its alpha was premultiplied when it was built.
  if ((map as Texture & { isCompressedTexture?: boolean }).isCompressedTexture) return;
  map.premultiplyAlpha = premultiply;
  map.generateMipmaps = true;
  map.minFilter = LinearMipmapLinearFilter;
  map.magFilter = LinearFilter;
}

/**
 * Two complete configurations, compared on the Quest's own framebuffer:
 * - blend, the M0 default: premultiplied texture, One/OneMinusSrcAlpha, the faintest pixels
 *   (which carry the paper's tint) dropped and kept out of depth;
 * - coverage: straight alpha resolved by multisampling, writing depth, never blended or sorted.
 */
export function cardMaterial(map: Texture, { face = 'front', config = defaultConfig, pool = true, doubleSided = false, solid = false, baked = false }: CardOptions = {}): MeshBasicMaterial {
  const coverage = config === 'coverage';
  prepareMap(map, !coverage && !solid && !baked);
  const material = new MeshBasicMaterial({
    map,
    side: doubleSided ? DoubleSide : FrontSide,
    toneMapped: false,
    ...(solid
      ? { transparent: false }
      : coverage
      ? { transparent: false, alphaToCoverage: true, alphaTest: 0.5, blending: NoBlending, depthWrite: true }
      : {
          transparent: true,
          alphaTest: 0.25,
          blending: CustomBlending,
          blendSrc: OneFactor,
          blendDst: OneMinusSrcAlphaFactor,
          blendSrcAlpha: OneFactor,
          blendDstAlpha: OneMinusSrcAlphaFactor,
        }),
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uTint: stageLook.tint,
      uPoolPos: stageLook.poolPos,
      uPoolRadius: stageLook.poolRadius,
      uPoolStrength: stageLook.poolStrength,
      uPoolColor: stageLook.poolColor,
      uPageColor: stageLook.pageColor,
      uSilhouette: stageLook.silhouette,
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vStageWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n\tvStageWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    const back = face === 'back' ? '\n\tdiffuseColor.rgb = uPageColor * diffuseColor.a;' : '';
    // Depth occlusion (when on) scales alpha before the map is sampled. A premultiplied card must
    // scale its colour by the same amount, or a half-hidden edge glows.
    const premultiplied = !coverage && !solid;
    const occlusion = premultiplied ? '\n\tdiffuseColor.rgb *= cardOcclusion;' : '';
    const light = pool
      ? `\n\tfloat poolFall = 1.0 - smoothstep(0.0, uPoolRadius, distance(vStageWorld, uPoolPos));
\toutgoingLight += outgoingLight * uPoolColor * (uPoolStrength * poolFall * poolFall);`
      : '';
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vStageWorld;\nuniform vec3 uTint;\nuniform vec3 uPoolPos;\nuniform float uPoolRadius;\nuniform float uPoolStrength;\nuniform vec3 uPoolColor;\nuniform vec3 uPageColor;\nuniform float uSilhouette;',
      )
      .replace('#include <map_fragment>', `float cardOcclusion = diffuseColor.a / max(opacity, 0.0001);\n\t#include <map_fragment>${occlusion}${back}`)
      .replace('vec3 outgoingLight = reflectedLight.indirectDiffuse;', `vec3 outgoingLight = reflectedLight.indirectDiffuse;\n\toutgoingLight *= uTint;${light}\n\toutgoingLight *= 1.0 - uSilhouette;`);
  };
  material.userData.card = true;
  material.customProgramCacheKey = () => `card:${face}:${solid ? 'solid' : config}:${pool ? 'pool' : 'flat'}`;
  return material;
}

/**
 * A solid painted surface (page, cloth, cover) that still takes the stage's mood. `over` lays a
 * piece with transparent parts onto a solid colour, so a page edge never shows through to black.
 */
export function surfaceMaterial(options: { ref?: { texture: Texture; baked: boolean }; color?: string | Color; over?: string }): MeshBasicMaterial {
  const map = options.ref?.texture ?? null;
  if (map) prepareMap(map, false);
  const material = new MeshBasicMaterial({ map, color: options.color ?? 0xffffff, toneMapped: false });
  const over = options.over ? new Color(options.over) : null;
  const baked = options.ref?.baked ?? false;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTint = stageLook.tint;
    shader.uniforms.uOver = { value: over ?? new Color(1, 1, 1) };
    const composite = !over
      ? ''
      : baked
        ? '\n\tdiffuseColor.rgb += uOver * (1.0 - diffuseColor.a); diffuseColor.a = 1.0;'
        : '\n\tdiffuseColor.rgb = mix(uOver, diffuseColor.rgb, diffuseColor.a); diffuseColor.a = 1.0;';
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uTint;\nuniform vec3 uOver;')
      .replace('#include <map_fragment>', `#include <map_fragment>${composite}`)
      .replace('vec3 outgoingLight = reflectedLight.indirectDiffuse;', 'vec3 outgoingLight = reflectedLight.indirectDiffuse;\n\toutgoingLight *= uTint;');
  };
  material.customProgramCacheKey = () => `surface:${over ? (baked ? 'over-baked' : 'over') : 'plain'}`;
  return material;
}
