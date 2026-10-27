import { createReadStream, cpSync, existsSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/** Le moteur du jeu et ses images sont dans `../game/`, communs au lab et au folio. */
const game = fileURLToPath(new URL('../game', import.meta.url));

const TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
};

/**
 * Second dossier public : les images du jeu (`../game/public/`), servies à la racine du site comme celles de
 * `public/`. En développement, un intermédiaire les sert ; au build, elles sont recopiées dans le dossier de sortie.
 */
function gamePublic(dir: string): Plugin {
  let outDir = '';
  return {
    name: 'game-public',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const base = server.config.base;
        const url = decodeURIComponent((request.url ?? '').split('?')[0] ?? '');
        if (!url.startsWith(base)) {
          next();
          return;
        }
        const file = join(dir, url.slice(base.length));
        if (!file.startsWith(dir + sep) || !existsSync(file) || !statSync(file).isFile()) {
          next();
          return;
        }
        response.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
        createReadStream(file).pipe(response);
      });
    },
    writeBundle() {
      cpSync(dir, outDir, { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [react(), gamePublic(`${game}/public`)],
  resolve: { alias: { '@game': `${game}/src` } },
  server: { fs: { allow: ['..'] } },
  test: {
    include: ['src/**/*.test.ts', '../game/src/**/*.test.ts'],
  },
});
