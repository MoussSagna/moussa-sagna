import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Le moteur du jeu et ses images sont dans `../game/`, commun au lab et au folio.
const game = fileURLToPath(new URL('../game', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@game': `${game}/src` } },
  // les images du jeu sont servies telles quelles, depuis le dossier commun
  publicDir: `${game}/public`,
  server: { fs: { allow: ['..'] } },
})
