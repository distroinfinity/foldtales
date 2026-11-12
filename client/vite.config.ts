import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { iwsdkDev } from '@iwsdk/vite-plugin-dev';
import { defineConfig, type ServerOptions } from 'vite';
import { readPorts } from '../tools/ports.ts';
import { artPlugin } from './vite/art-plugin.ts';

const manifest = JSON.parse(readFileSync(new URL('./public/show/manifest.json', import.meta.url), 'utf8')) as { artFolders: string[] };

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

export default defineConfig(({ command }) => ({
  plugins: [
    iwsdkDev(),
    artPlugin({
      artRoot: fileURLToPath(new URL('../art', import.meta.url)),
      folders: manifest.artFolders,
      ktx2: { cacheDir: fileURLToPath(new URL('./.art-cache', import.meta.url)) },
    }),
  ],
  // Only serving needs ports, so a CDN builder with no .env.ports can still build.
  ...(command === 'serve' ? { server: devServer(), preview: devServer() } : {}),
  // Vite also exposes matching process variables, so the prefix is what keeps keys out.
  envPrefix: 'TT_PUBLIC_',
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV !== 'production',
    target: 'esnext',
    rollupOptions: { input: './index.html' },
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
