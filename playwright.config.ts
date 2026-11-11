import { defineConfig } from '@playwright/test';

// Тесты гоняют собранную версию (dist) — то же, что уедет на GitHub Pages.
export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173/',
    // локально используем установленный Chrome; в CI — chromium от Playwright
    channel: process.env.CI ? undefined : 'chrome',
    viewport: { width: 1280, height: 800 },
  },
  webServer: { command: 'npm run build && npx vite preview --port 4173 --strictPort', url: 'http://localhost:4173/', reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
