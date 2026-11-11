// Сборка: каждая страница — один HTML со встроенным JS (vite-plugin-singlefile),
// поэтому dist/**/index.html открывается и с GitHub Pages, и двойным кликом с диска.
import { build } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { PAGES } from './pages.mjs';

for (const [i, page] of PAGES.entries()) {
  await build({
    configFile: false,
    base: './',
    logLevel: 'warn',
    plugins: [viteSingleFile({ removeViteModuleLoader: true })],
    build: { outDir: 'dist', emptyOutDir: i === 0, copyPublicDir: i === 0, rollupOptions: { input: page } },
  });
  console.log('built', page);
}
