import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { PAGES } from './scripts/pages.mjs';

// dev: обычный многостраничный режим (npm run dev).
// Продакшн-сборку делает scripts/build.mjs: каждая страница отдельно, в один самодостаточный HTML.
export default defineConfig({
  base: './',
  build: { rollupOptions: { input: Object.fromEntries(PAGES.map(p => [p, resolve(p)])) } },
});
