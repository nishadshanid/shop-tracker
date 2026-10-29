import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the demo from /<repo>/; Cloudflare serves from /
  base: process.env.BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
})
