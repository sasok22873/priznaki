# ПРИЗНАКИ БЕШЕНСТВА 24 — v2

Полный рефакторинг штаба группы на новый стек:

- **Backend:** Node.js, Express, PostgreSQL, Prisma ORM
- **Авторизация:** Keycloak (OIDC, Authorization Code + PKCE), роли `owner/member/viewer`
- **Frontend:** React, TypeScript, Zod, Zustand, TanStack Query, Tailwind, FSD
- **Mobile:** React Native (Expo), OIDC через Keycloak, FSD
- **Монорепа:** pnpm workspaces
- **Тесты:** Vitest + Supertest (API + проверка Keycloak-JWT на локальных ключах)
- **CI:** GitHub Actions

## Структура

```
apps/
  api/       Express + Prisma (REST /api), проверка Keycloak JWT по JWKS
  web/       React SPA (Vite, Tailwind, FSD), вход через Keycloak
  mobile/    Expo (React Native, FSD), Keycloak OIDC
packages/
  shared/    Zod-схемы и типы, общие для api/web/mobile
keycloak/    realm-import: realm priznaki, роли, клиенты pb-web/pb-mobile, тестовые пользователи
docker/      init-скрипты Postgres (база для Keycloak)
docs/
  ARCHITECTURE.md     архитектура и контракты
  MIGRATION_PLAN.md   план миграции по этапам
  AGENTS.md           состав ИИ-агентов для разработки
```

## Запуск локально (Docker)

Нужен установленный Docker Desktop.

```bash
cd v2
docker compose up -d db keycloak
# Keycloak: http://localhost:8080 (admin / admin)
# realm priznaki импортируется автоматически

docker compose up -d api web
# Web:      http://localhost:8080
# API:      http://localhost:4000/health
# Postgres: localhost:5432 (pb / pb)
```

**Пользователи realm `priznaki`:**

| Логин | Пароль | Роль |
|---|---|---|
| `owner` | `owner123` | владелец |
| `member` | `member123` | участник |
| `viewer` | `viewer123` | наблюдатель |

## Разработка без Docker (только web/api, Keycloak нужен отдельно)

```bash
corepack enable
pnpm install
cp apps/api/.env.example apps/api/.env      # DATABASE_URL + KEYCLOAK_*
cp apps/web/.env.example apps/web/.env
pnpm db:generate
pnpm dev:api        # http://localhost:4000
pnpm dev:web        # http://localhost:5173
```

Keycloak можно поднять только контейнером:
`docker compose up -d db keycloak`.

## Проверки

```bash
pnpm typecheck           # shared + api + web
pnpm typecheck:mobile    # Expo TypeScript
pnpm --filter @pb/api test
pnpm build
```

## Статус миграции

Каркас + вертикальный срез «Вход через Keycloak → Задачи (канбан/бэклог)».
Старый сайт (`../priznaki`) продолжает работать; данные в Postgres не тронуты.
Дальше — перенос остальных доменов по плану в `docs/MIGRATION_PLAN.md`.
