# gitCAD — контроль версий, ревью и релизы для чертежей и 3D (PDM/PLM-lite)

gitCAD — платформа для хранения и согласования чертежей и 3D-моделей поверх сетевых папок.  
Она фиксирует изменения (кто/когда/что), упрощает ревью с комментариями по месту и помогает выпускать утверждённые версии без путаницы.

gitCAD — GitHub-подобная система версий и ревью для инженерных файлов. 
Вы подключаете папку с проектом — gitCAD превращает её в “репозиторий”: строит дерево, фиксирует ревизии и авторов изменений (кто/когда/что),
показывает предпросмотр PDF и 3D прямо в браузере, позволяет оставлять замечания по месту, проводить ревью и согласование, 
и выпускать релизы утверждённых версий.


## Стек

**Core**
- Next.js (App Router) + React 19
- TypeScript
- pnpm

**UI**
- TailwindCSS
- shadcn/ui (Radix) + Radix UI при необходимости
- lucide-react

**Данные и состояние**
- TanStack Query — всё, что пришло с сервера (кэш, пагинация, фоновые обновления)
- Zustand — чистый UI state (выбор файла, панели, режимы viewer, локальные черновики)
- zod — парсинг/валидация DTO и env

**Таблицы/дерево/виртуализация**
- @tanstack/react-table
- react-virtual
- (опционально) dnd-kit

**Viewer**
- PDF.js (pdfjs-dist / react-обвязка)
- Three.js или react-three-fiber

**Realtime**
- WebSocket (или SSE как упрощённый вариант)

**Качество**
- ESLint + Prettier
- Vitest (unit)
- Playwright (e2e)

---

## Что стоит улучшить (рекомендации)

### 1) Добавить слой `widgets/` (по FSD)
Сейчас `processes` частично играет роль “склейки UI”. В FSD обычно есть:
- **widgets/** — крупные UI-композиции (Sidebar, ViewerPane, RightPanel)
- **processes/** — длинные пользовательские процессы/сценарии (review-flow, release-flow)

Так будет проще переиспользовать “большие куски” между страницами и не раздувать `processes/`.

### 2) Единый API-клиент + типобезопасные ключи Query
Рекомендуется завести:
- `shared/api/http.ts` — fetch wrapper (baseUrl, cookies, errors)
- `shared/api/queryKeys.ts` — фабрики ключей (чтобы не было строк “как попало”)
- `shared/api/errors.ts` — единая типизация ошибок (NetworkError/ApiError/ValidationError)

**Плюсы:** стабильная инвалидция кэша, меньше багов при refetch, проще рефакторить.

### 3) Стандартизировать пагинацию/курсор и события realtime
Чтобы фронт был проще:
- Пагинация: единый формат `cursor`, `nextCursor`, `items`
- Realtime: единая схема события `{ type, payload, ts, entityId }`

### 4) PDF/3D viewer — разгрузить main thread
- PDF.js: обязательно worker (и `dynamic import` без SSR)
- Рендер страниц: лениво/по viewport + троттлинг зума/скролла
- 3D: хранение `cameraPose` отдельно, а heavy-парсинг/декод — по возможности в worker (или хотя бы chunked)

### 5) Безопасная авторизация (если JWT)
- Access/Refresh в **httpOnly cookie**
- `SameSite=Lax/Strict`, `Secure` в проде
- CSRF-защита (double submit cookie или CSRF token endpoint), если есть опасные POST из браузера

### 6) Инженерная “обвязка”
- `lint-staged` + `husky` (format/lint на pre-commit)
- CI: lint + typecheck + unit + e2e smoke
- `@next/bundle-analyzer` для контроля веса viewer-зависимостей

---

## Архитектура (FSD)

Слои:
- `app/` — Next.js роуты, layout, провайдеры, глобальные стили
- `processes/` — пользовательские сценарии (например, review flow)
- `widgets/` — крупные UI-блоки (рекомендуется добавить)
- `features/` — фичи (approve review, add comment, diff toggle)
- `entities/` — доменные сущности (repo, file, revision, review, user)
- `shared/` — общий код (ui-kit, api, hooks, lib, config)

Базовые правила:
- `entities` не импортируют `features/processes/widgets`
- `features` могут использовать `entities` и `shared`
- `processes/widgets` собирают несколько `features`
- Сеть: только через `shared/api` и `entities/*/api`
- DTO с бэка: `zod.parse()` на границе (api слой)

---

## Предложенная структура

> Твоя структура хорошая — ниже минимальные правки: добавить `widgets/`, вынести общие типы/ключи, и слегка упорядочить viewer.

```
src/
  app/
    (public)/
      page.tsx
    (auth)/
      login/page.tsx
    projects/[projectId]/repos/[repoId]/
      layout.tsx
      page.tsx
      files/page.tsx
      revisions/page.tsx
      reviews/page.tsx
      releases/page.tsx
      settings/page.tsx
    providers.tsx
    globals.css

  processes/
    review-flow/
      ui/ReviewWorkspace.tsx
      model/useReviewFlow.ts

  widgets/                       # рекомендуется
    repo-shell/
      ui/RepoShell.tsx           # sidebar + viewer + right panel layout
    viewer-pane/
      ui/ViewerPane.tsx

  features/
    auth/
    file-tree/
    viewer-pdf/
    viewer-3d/
    annotations/
    reviews/
    releases/

  entities/
    repo/
    file/
    revision/
    review/
    user/

  shared/
    api/
      http.ts
      ws.ts
      queryClient.ts
      queryKeys.ts              # рекомендуется
      errors.ts                 # рекомендуется
    config/
      env.ts
    ui/
    lib/
    hooks/
```

---

## Состояние и данные

**TanStack Query**
- Репозитории, дерево, ревью, комменты, превью
- Паттерн: `queryKeyFactory` + `invalidateQueries` по сущности/репо
- Для mutations: оптимистичные апдейты там, где это безопасно (комменты/статусы)

**Zustand (UI state)**
- выбранный файл/ревизия
- открытые панели
- режим viewer (pan/zoom/annotations)
- локальные черновики аннотаций до отправки

---

## Viewer и аннотации

**PDF**
- PDF.js в worker
- SVG overlay слой:
    - pins / rect / line
    - координаты: хранить в нормализованных координатах страницы (page, x, y, w, h)
    - привязка к zoom: пересчитывается только в рендере, не в данных

**3D**
- Аннотация: `{ cameraPose, hitPoint, objectId, commentId }`
- При открытии ревью: можно “перепрыгивать” по аннотациям, выставляя cameraPose

---

## Realtime (WS/SSE)

События (пример):
- `scanProgress`
- `previewReady`
- `reviewUpdated`
- `fileChanged`

Рекомендация:
- если нужен только push-апдейт и прогресс → **SSE**
- если нужен чат/двусторонние действия → **WebSocket**

---

## API (минимальный контракт)

Пример:
- `GET /repos/:id/tree?path=&cursor=`
- `GET /files/:id/revisions?cursor=`
- `GET /revisions/:id/preview` (pdf/thumbnail/glb)
- `GET /reviews?repoId=`
- `POST /reviews`
- `POST /comments`
- `PATCH /comments/:id` (resolve)

Рекомендация для фронта:
- единый ответ пагинации: `{ items, nextCursor }`
- единый формат ошибок: `{ code, message, details? }`

---

## Локальная разработка

### Требования
- Node.js LTS
- pnpm

### Установка
```bash
pnpm i
```

### Запуск
```bash
pnpm dev
```

### Проверки
```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm e2e
```

---

## Тестирование

- **Vitest**: unit для утилит, store, queryKey factories, парсеров zod
- **Playwright**: e2e “happy path”
    - открыть PDF → создать коммент → отправить ревью → получить realtime обновление

---

## Contribution (коротко)

- Не смешивать domain-логику в `shared/ui`
- DTO валидируем zod на границе API
- Все сетевые вызовы — через `entities/*/api` или `shared/api`
- Большие UI-композиции — в `widgets/`, процессы — в `processes/`

---

## MCP интеграция

Подробно: [README_MCP.md](README_MCP.md)

Быстрый запуск MCP (stdio):

```bash
pnpm build
pnpm mcp:stdio
```

Проверка через MCP Inspector:

```bash
npx @modelcontextprotocol/inspector pnpm mcp:stdio
```

Если используется HTTP transport:

```bash
pnpm build
pnpm mcp:http
```

Endpoint:

```text
http://127.0.0.1:8787/mcp
```
