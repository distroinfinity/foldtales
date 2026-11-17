import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { iwsdkDev } from '@iwsdk/vite-plugin-dev';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type ServerOptions } from 'vite';
import { readPorts } from '../tools/ports.ts';
import { artPlugin } from './vite/art-plugin.ts';
import { noticesPlugin } from './vite/notices-plugin.ts';
import { offlinePlugin } from './vite/offline-plugin.ts';

const manifest = JSON.parse(readFileSync(new URL('./public/show/manifest.json', import.meta.url), 'utf8')) as { artFolders: string[] };

/**
 * Which build a telemetry session came from: the commit (from the CI or the checkout), with the
 * mode and a mark if the checkout had uncommitted changes. An explicit TT_PUBLIC_BUILD_ID wins.
 */
function buildId(mode: string): string {
  if (process.env.TT_PUBLIC_BUILD_ID) return process.env.TT_PUBLIC_BUILD_ID;
  let sha = process.env.GITHUB_SHA ?? process.env.CF_PAGES_COMMIT_SHA ?? '';
  let dirty = false;
  try {
    sha ||= execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    dirty = execSync('git status --porcelain', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() !== '';
  } catch {
    // No git (a bare upload): the mode alone.
  }
  return `${sha.slice(0, 12) || 'unknown'}${dirty ? '+dirty' : ''}-${mode}`;
}

const licence = (name: string): string => fileURLToPath(new URL(`./vite/licences/${name}`, import.meta.url));
const packageVersion = (name: string): string => (JSON.parse(readFileSync(new URL(`./node_modules/${name}/package.json`, import.meta.url), 'utf8')) as { version: string }).version;

function devServer(): ServerOptions {
  const { CLIENT_PORT, BACKEND_PORT } = readPorts();
  return {
    host: '127.0.0.1',
    port: CLIENT_PORT,
    open: false,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${BACKEND_PORT}`,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  };
}

export default defineConfig(({ command, mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    iwsdkDev(),
    artPlugin({
      artRoot: fileURLToPath(new URL('../art', import.meta.url)),
      folders: manifest.artFolders,
      ktx2: { cacheDir: fileURLToPath(new URL('./.art-cache', import.meta.url)) },
    }),
    // Third-party licence texts for everything shipped (notices.txt, linked from About), plus the
    // Basis transcoder the art plugin copies in outside the bundle.
    noticesPlugin({
      extras: () => [
        {
          name: 'Basis Universal transcoder (from three.js)',
          version: packageVersion('three'),
          license: 'Apache-2.0',
          files: ['basis-universal-LICENSE.txt', 'basis-universal-NOTICE.txt'].map(licence),
        },
        { name: 'Magic UI (Blur Fade, Text Animate, Shimmer Button, Particles), adapted in the page', version: '', license: 'MIT', files: [licence('magic-ui-LICENSE.txt')] },
        { name: 'Tailwind CSS (the page\'s generated styles)', version: packageVersion('tailwindcss'), license: 'MIT', files: [fileURLToPath(new URL('./node_modules/tailwindcss/LICENSE', import.meta.url))] },
        { name: 'Music: "Piano Ambience chord progression 82bpm" by CVLTIV8R (Freesound #810857)', version: '', license: 'CC0-1.0', files: [fileURLToPath(new URL('../art/sound/music/LICENCE.md', import.meta.url))] },
      ],
      fallbacks: { 'yoga-layout': [licence('yoga-layout-LICENSE.txt')] },
    }),
    // The offline cache's worker, written last. Production builds only; TT_PUBLIC_SW=off is its kill switch.
    offlinePlugin({ enabled: mode === 'production', off: process.env.TT_PUBLIC_SW === 'off' }),
  ],
  // Only serving needs ports, so a CDN builder with no .env.ports can still build.
  ...(command === 'serve' ? { server: devServer(), preview: devServer() } : {}),
  // Vite also exposes matching process variables, so the prefix is what keeps keys out.
  envPrefix: 'TT_PUBLIC_',
  define: command === 'build' ? { 'import.meta.env.TT_PUBLIC_BUILD_ID': JSON.stringify(buildId(mode)) } : {},
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV !== 'production',
    target: 'esnext',
    // The page, plus the 2D pages that never load the 3D book.
    rollupOptions: { input: { main: './index.html', about: './about/index.html', privacy: './privacy/index.html', terms: './terms/index.html', link: './link/index.html', authReturn: './auth/return/index.html' } },
  },
  esbuild: { target: 'esnext' },
  resolve: { dedupe: ['three'] },
  optimizeDeps: {
    exclude: ['@babylonjs/havok'],
    include: ['three'],
    esbuildOptions: { target: 'esnext' },
  },
  publicDir: 'public',
  base: './',
}));
