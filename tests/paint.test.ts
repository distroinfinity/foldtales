import { describe, expect, test } from 'vitest';
import { OneFactor, OneMinusSrcAlphaFactor, ShaderLib, Texture, UniformsUtils } from '@iwsdk/core';
import { cardMaterial, stageLook } from '../client/src/paint/card-material.ts';

function compiled(material: ReturnType<typeof cardMaterial>) {
  const shader = { uniforms: UniformsUtils.clone(ShaderLib.basic.uniforms), vertexShader: ShaderLib.basic.vertexShader, fragmentShader: ShaderLib.basic.fragmentShader };
  material.onBeforeCompile(shader as never, undefined as never);
  return shader;
}

describe('card material', () => {
  test('blend: soft edges from premultiplied art, the faintest pixels dropped', () => {
    const map = new Texture();
    const material = cardMaterial(map);
    expect(map.premultiplyAlpha).toBe(true);
    expect(material.transparent).toBe(true);
    expect([material.blendSrc, material.blendDst]).toEqual([OneFactor, OneMinusSrcAlphaFactor]);
    expect(material.alphaTest).toBeCloseTo(0.25);
  });

  test('coverage: straight alpha resolved by multisampling, writing depth, not blended', () => {
    const map = new Texture();
    const material = cardMaterial(map, { config: 'coverage' });
    expect(map.premultiplyAlpha).toBe(false);
    expect(material.alphaToCoverage).toBe(true);
    expect(material.transparent).toBe(false);
    expect(material.depthWrite).toBe(true);
  });

  test('every card shares one tint and one lantern pool, so the mood is one value across the stage', () => {
    const a = compiled(cardMaterial(new Texture()));
    const b = compiled(cardMaterial(new Texture(), { face: 'back' }));
    expect(a.uniforms.uTint).toBe(stageLook.tint);
    expect(b.uniforms.uTint).toBe(stageLook.tint);
    expect(a.uniforms.uPoolPos).toBe(stageLook.poolPos);
  });

  test('the injection lands in the real shader', () => {
    const shader = compiled(cardMaterial(new Texture()));
    expect(shader.vertexShader).toContain('vStageWorld =');
    expect(shader.fragmentShader).toContain('outgoingLight *= uTint');
    expect(shader.fragmentShader).toContain('uPoolStrength');
  });

  test('a back is page-coloured card in the shape of the art', () => {
    const material = cardMaterial(new Texture(), { face: 'back' });
    expect(compiled(material).fragmentShader).toContain('uPageColor * diffuseColor.a');
    expect(material.customProgramCacheKey()).not.toBe(cardMaterial(new Texture()).customProgramCacheKey());
  });

  test('an unlit card takes the mood but not the lantern pool', () => {
    expect(compiled(cardMaterial(new Texture(), { pool: false })).fragmentShader).not.toContain('poolFall');
  });

  test('solid: the printed ground is opaque but still takes the lantern pool', () => {
    const material = cardMaterial(new Texture(), { solid: true });
    expect(material.transparent).toBe(false);
    expect(material.alphaTest).toBe(0);
    expect(compiled(material).fragmentShader).toContain('poolFall');
  });

  test('depth occlusion scales a premultiplied card\'s colour with its alpha, so a hidden edge cannot glow', () => {
    const shader = compiled(cardMaterial(new Texture()));
    const before = shader.fragmentShader.indexOf('float cardOcclusion');
    const map = shader.fragmentShader.indexOf('#include <map_fragment>');
    expect(before).toBeGreaterThan(-1);
    expect(before).toBeLessThan(map);
    expect(shader.fragmentShader).toContain('diffuseColor.rgb *= cardOcclusion');
  });
});
