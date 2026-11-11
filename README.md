# Mariia Play

Живые интерактивные сцены для дошкольников: Canvas 2D + WebAudio, без текста в интерфейсе.

```bash
npm install
npm run dev     # разработка: http://localhost:5173
npm test        # сборка + сценарные тесты (Playwright, локально использует установленный Chrome)
npm run build   # dist/ — каждая страница один HTML, открывается и двойным кликом
```

Push в `main` автоматически тестирует и публикует сайт на GitHub Pages. Подробности устройства — в `CLAUDE.md`.
