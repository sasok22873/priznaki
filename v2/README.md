# ПРИЗНАКИ БЕШЕНСТВА 24 — v2

Полный рефакторинг штаба группы на новый стек:

- **Backend:** Node.js, Express, PostgreSQL, Prisma ORM
- **Frontend:** React, TypeScript, Zod, Zustand, TanStack Query, Tailwind, FSD
- **Mobile:** React Native (Expo), FSD
- **Монорепа:** pnpm workspaces
- **Тесты:** Vitest + Supertest (API)
- **CI:** GitHub Actions

## Структура

```
apps/
  api/       Express + Prisma (REST /api)
  web/       React SPA (Vite, Tailwind, FSD)
  mobile/    Expo (React Native, FSD)
packages/
  shared/    Zod-схемы и типы, общие для api/web/mobile
docs/
  ARCHITECTURE.md     архитектура и контракты
  MIGRATION_PLAN.md   план миграции по этапам
  AGENTS.md           состав ИИ-агентов для разработки
```

## Быстрый старт

```bash
corepack enable
pnpm install
cp apps/api/.env.example apps/api/.env      # вписать DATABASE_URL и SUPABASE_URL
cp apps/web/.env.example apps/web/.env      # вписать ключи Supabase
pnpm db:generate
pnpm dev:api        # http://localhost:4000
pnpm dev:web        # http://localhost:5173
```

## Проверки

```bash
pnpm typecheck
pnpm --filter @pb/api test
pnpm build
```

## Статус миграции

Каркас + вертикальный срез «Вход → Задачи (канбан/бэклог)» на новом стеке.
Старый сайт (`../priznaki`) продолжает работать, данные в Supabase не тронуты.
Дальше — перенос остальных доменов по плану в `docs/MIGRATION_PLAN.md`.
