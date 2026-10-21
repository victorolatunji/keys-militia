import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths so the build works on GitHub Pages (served from /keys-militia/)
  base: './',
  server: { port: 5173 },
});