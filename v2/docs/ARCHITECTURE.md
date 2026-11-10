# Архитектура v2

## 1. Общая схема

```
React SPA (Vite, FSD) ──┐
                        ├── REST /api ──► Express (Node 20) ──► Prisma ──► PostgreSQL
Expo App (RN, FSD) ─────┘                              │
                                                       └── Auth: Keycloak (OIDC, JWKS-валидация access-токена)
```

- **База данных** — тот же проект Supabase Postgres, чтобы миграция была бесшовной.
  Prisma-схема повторяет текущие `public`-таблицы (`tasks`, `goals`, `projects`, `directions`, `profiles`…),
  статусы старых значений (`new`, `review`, `cancelled`) маппятся в новый набор (`planned`, `in_progress`, `done`).
- **Аутентификация** — Keycloak (realm `priznaki`): web использует `keycloak-js`
  (Authorization Code + PKCE, клиент `pb-web`), mobile — `expo-auth-session` (клиент `pb-mobile`,
  redirect `priznaki24://auth`). API проверяет access-токен по JWKS
  (`/realms/priznaki/protocol/openid-connect/certs`), issuer, аудиторию `pb-api`
  и вытаскивает роль из `realm_access.roles` (owner/member/viewer).
  Тестовые пользователи: owner/member/viewer (`owner123`/`member123`/`viewer123`).
- **Права** — роли из Keycloak: `owner`/`member` пишут, `viewer` только читает;
  менять/удалять задачу может владелец или автор (`created_by`/`owner_id`).

## 2. Backend (`apps/api`)

Слои модуля (feature-first):

```
src/
  config/env.ts            Zod-валидация переменных окружения
  shared/                  db (PrismaClient), http (asyncHandler, errors), errors
  middleware/              auth (profile/role), supabase-auth (JWKS)
  modules/
    tasks/                 router → service → mapper (+ Zod из @pb/shared)
    catalog/               направления, цели, проекты одним запросом
  app.ts                   createApp(deps) — DI для тестов
  server.ts                сборка зависимостей и listen
```

`createApp({ db, verifyToken })` позволяет подменять базу и проверку токена в тестах
(Supertest + Vitest, in-memory фейк Prisma).

### API (v1)

| Метод | Путь | Описание |
|---|---|---|
| GET | `/health` | живость сервиса |
| GET | `/api/me` | текущий пользователь и роль |
| GET | `/api/tasks?status=&goal=&project=&q=&limit=` | список задач |
| POST | `/api/tasks` | создать (Zod-валидация) |
| PATCH | `/api/tasks/:id` | изменить (статус/срок/поля) |
| DELETE | `/api/tasks/:id` | удалить |
| GET | `/api/catalog` | направления + цели + проекты |

Ошибки — единый формат `{ error: { code, message, details? } }`.

## 3. Frontend (`apps/web`, FSD)

```
src/
  app/        провайдеры (QueryClient, Router), роутер, глобальные стили
  pages/      login, tasks
  widgets/    tasks-board (колонки канбана, drag&drop)
  features/   task-status (мутации статуса/создания/удаления)
  entities/   task (api/ui), session (Zustand + persist)
  shared/     api-клиент, config (env), ui-кит, lib
```

- Каждый слайс имеет public API `index.ts`; импорты только через него.
- Серверное состояние — TanStack Query, клиентское (сессия, фильтры) — Zustand.
- Формы и ответы API валидируются Zod (`packages/shared`).
- Стили — Tailwind с дизайн-токенами из старого приложения (тёмная тема, акцент `#a78bfa`).

## 4. Mobile (`apps/mobile`)

Expo + React Native, та же FSD-разбивка (`app/pages/entities/shared`),
TanStack Query и Zustand (persist через AsyncStorage), общие Zod-типы из `@pb/shared`.

## 5. Данные

Prisma-схема (см. `apps/api/prisma/schema.prisma`) описывает текущие таблицы.
Домены переносятся по одному: сначала `tasks` (готово), затем `goals/projects/directions`,
`events`, `bank`, `brainstorm`, `promo`, `team/settings`.

## 6. Инфраструктура

- **CI** — `.github/workflows/ci.yml`: install → typecheck → prisma validate → tests → build web → docker build.
- **Локально** — `docker-compose.yml` (postgres + api + web).
- **Прод** — API: Render/Railway/Fly (Docker), Web: Vercel/Cloudflare Pages, Mobile: EAS Build.
  Секреты: `DATABASE_URL`, `KEYCLOAK_*`, `VITE_KEYCLOAK_*`, `EXPO_PUBLIC_*`.
