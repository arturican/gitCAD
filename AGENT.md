# AGENT.md

Руководство для AI/код-агентов, работающих в репозитории `gitCAD`.

## 1. Контекст продукта

`gitCAD` — PDM/PLM-lite платформа для инженерных файлов (чертежи, PDF, 3D):
- хранение и версионирование изменений (кто/когда/что);
- ревью и комментарии “по месту”;
- согласование и выпуск утвержденных релизов.

Главная цель разработки: делать GitHub-подобный UX для инженерных файлов в браузере, поверх сетевых папок.

## 2. Технологический стек

- Next.js (App Router) + React 19
- TypeScript
- pnpm
- TailwindCSS
- shadcn/ui (Radix), при необходимости Radix UI
- lucide-react
- TanStack Query (server state)
- Zustand (UI state)
- zod (валидация DTO и env)
- @tanstack/react-table, react-virtual, опционально dnd-kit
- PDF.js (pdfjs-dist / react wrapper)
- Three.js или react-three-fiber
- WebSocket или SSE
- ESLint + Prettier
- Vitest (unit), Playwright (e2e)

## 3. Архитектура и правила слоев (FSD)

Целевые слои:
- `app/` — роутинг, layout, провайдеры, глобальные стили.
- `processes/` — длинные сценарии (например, review flow).
- `widgets/` — крупные UI-композиции (Sidebar, ViewerPane, RightPanel).
- `features/` — пользовательские фичи.
- `entities/` — доменные сущности.
- `shared/` — переиспользуемая инфраструктура, UI-kit, хелперы.

Обязательные правила импорта:
- `entities` не импортируют `features/processes/widgets`.
- `features` могут использовать только `entities` и `shared`.
- `widgets/processes` собирают несколько `features`.
- Сетевой слой только через `shared/api` и `entities/*/api`.
- Все внешние DTO валидируются через `zod.parse()` на границе API.

## 4. Рекомендуемая структура `src/`

```text
src/
  app/
  processes/
  widgets/
  features/
  entities/
  shared/
    api/
      http.ts
      ws.ts
      queryClient.ts
      queryKeys.ts
      errors.ts
    config/
      env.ts
```

## 5. Данные и состояние

TanStack Query:
- хранит все данные сервера (repos/tree/reviews/comments/previews);
- использовать фабрики ключей (`queryKeyFactory`);
- инвалидировать кэш по сущности/репозиторию;
- оптимистичные обновления только там, где безопасно.

Zustand:
- только UI state (выбор файла/ревизии, панели, режим viewer, локальные черновики).

## 6. Viewer и аннотации

PDF:
- PDF.js запускать через worker;
- тяжелые viewer-модули грузить динамически без SSR;
- рендер страниц ленивый (по viewport), масштаб/скролл троттлить;
- аннотации хранить в нормализованных координатах страницы (`page, x, y, w, h`).

3D:
- аннотация содержит как минимум `{ cameraPose, hitPoint, objectId, commentId }`;
- поддерживать переход к аннотации с восстановлением `cameraPose`.

## 7. Realtime

Базовый контракт события:
- `{ type, payload, ts, entityId }`

Типы событий (минимум):
- `scanProgress`
- `previewReady`
- `reviewUpdated`
- `fileChanged`

Транспорт:
- SSE — если нужны push-обновления/прогресс без двустороннего канала;
- WebSocket — если нужны чат/двусторонние realtime-действия.

## 8. API-контракты

Целевые принципы:
- пагинация в едином формате: `{ items, nextCursor }`;
- ошибки в едином формате: `{ code, message, details? }`;
- курсорная пагинация в списках.

Примеры endpoint-ов:
- `GET /repos/:id/tree?path=&cursor=`
- `GET /files/:id/revisions?cursor=`
- `GET /revisions/:id/preview`
- `GET /reviews?repoId=`
- `POST /reviews`
- `POST /comments`
- `PATCH /comments/:id`

## 9. Безопасность (если JWT)

- Access/Refresh токены хранить в `httpOnly` cookie;
- `SameSite=Lax/Strict`, `Secure` в production;
- использовать CSRF-защиту для опасных браузерных POST.

## 10. Локальная разработка и проверки

Требования:
- Node.js LTS
- pnpm

Команды:

```bash
pnpm i
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm e2e
```

## 11. Тестовая стратегия

- Vitest: unit-тесты для утилит, store, query key factories, zod-парсеров.
- Playwright: e2e happy path (PDF -> коммент -> отправка ревью -> realtime-обновление).

## 12. Contribution rules

- Не смешивать domain-логику в `shared/ui`.
- Все сетевые вызовы вести через `entities/*/api` или `shared/api`.
- Большие UI-композиции держать в `widgets/`, пользовательские потоки — в `processes/`.
