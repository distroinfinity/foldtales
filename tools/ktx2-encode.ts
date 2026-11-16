import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The installed encoder's version, from its package.json in the nearest node_modules (it exports no require path). */
function encoderVersion(): string {
  for (let dir = dirname(fileURLToPath(import.meta.url)), i = 0; i < 6; i++, dir = dirname(dir)) {
    const file = join(dir, 'node_modules', 'ktx2-encoder', 'package.json');
    if (existsSync(file)) return (JSON.parse(readFileSync(file, 'utf8')) as { version: string }).version;
  }
  throw new Error("can't find ktx2-encoder's version");
}

/**
 * The one KTX2 encode the art build uses, shared by the build and its worker threads so both give
 * the same bytes. Every setting that changes the output is in `ENCODE_SETTINGS`, which is part of
 * each cached texture's key: change a setting and every texture is encoded again.
 */
export const ENCODE_SETTINGS = {
  isUASTC: true,
  isYFlip: true,
  uastcLDRQualityLevel: 2,
  needSupercompression: true,
  generateMipmap: true,
  isPerceptual: true,
  isSetKTX2SRGBTransferFunc: true,
  /** RDO only where there's no alpha: it smears soft edges. */
  rdoWhenOpaque: true,
  encoder: encoderVersion(),
} as const;

export async function encodeKtx2(rgba: Uint8Array, width: number, height: number, hasAlpha: boolean): Promise<Uint8Array> {
  const { encodeToKTX2 } = await import('ktx2-encoder');
  const { rdoWhenOpaque, encoder: _version, ...options } = ENCODE_SETTINGS;
  // The pixels are already decoded, so the "decoder" just hands them over.
  return encodeToKTX2(new Uint8Array(1), {
    ...options,
    imageDecoder: async () => ({ width, height, data: rgba }),
    enableRDO: hasAlpha ? false : rdoWhenOpaque,
  } as never);
}
