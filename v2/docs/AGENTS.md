# Агенты разработки v2

Стек разбит на независимые потоки. Ниже — состав агентов, зоны записи и порядок работы.
Каждый агент получает свою зону файлов, чтобы правки не пересекались.

## Обязательные агенты (ядро)

| # | Агент | Зона (write scope) | Задачи |
|---|---|---|---|
| 1 | `api-core` | `apps/api/**`, `packages/shared/**` | Express-роутеры, сервисы, Prisma-схема, авторизация/роли, миграции, unit-тесты API |
| 2 | `web-shell` | `apps/web/src/app/**`, `shared/**`, `entities/session/**` | FSD-каркас, роутинг, дизайн-система на Tailwind, вход, уведомления, ошибки |
| 3 | `web-tasks` | `entities/task/**`, `features/task-*`, `widgets/tasks-board/**`, `pages/tasks/**` | Канбан, бэклог, фильтры, формы задач, оптимистичные обновления |
| 4 | `web-calendar` | `entities/event/**`, `features/calendar-*`, `widgets/calendar/**`, `pages/calendar/**` | Месяц/повестка, drag&drop дат, ICS-подписка, интеграции |
| 5 | `web-bank` | `entities/file/**`, `features/upload-*`, `widgets/bank/**`, `pages/bank/**` | Яндекс.Диск через API, просмотрщик, тексты песен с разделами, папки/иконки |
| 6 | `web-brainstorm` | `entities/idea/**`, `features/brainstorm-*`, `widgets/brainstorm/**`, `pages/brainstorm/**` | Сессии, три этапа, голоса, ICE, конвертация идей |
| 7 | `web-promo-team` | `entities/channel/**`, `pages/promotion/**`, `pages/team/**`, `pages/settings/**` | Статистика каналов, графики, команда/доступы, настройки |
| 8 | `mobile-expo` | `apps/mobile/**` | Экран входа, задачи, календарь, банк, штурм (по мере паритета), EAS-конфиг |

## Агенты качества и инфраструктуры

| # | Агент | Зона | Задачи |
|---|---|---|---|
| 9 | `qa-autotests` | `tests/e2e/**`, `apps/*/tests/**` | Vitest (API), Playwright (web e2e), Detox (mobile), тест-данные, фикстуры |
| 10 | `devops-ci` | `.github/**`, `docker/**`, `docker-compose.yml`, `*.Dockerfile` | CI-пайплайн, Docker-образы, деплой на Render/Railway/Vercel, секреты, бэкапы |
| 11 | `design-auditor` | отчёт в `docs/design-reviews/**`; правки через владельцев зон | Проверка дизайна/вёрстки на 375/768/1440, a11y, консистентность токенов |
| 12 | `data-migration` | `docs/**`, `scripts/migration/**` | Сверка схемы Prisma с текущей БД, отчёты расхождений, скрипты переноса/проверки, dual-write чек-лист |

## Как они работают

1. **Lead** держит общий план, ставит задачи на общий борд, следит за контрактами API и финальной сборкой.
2. Каждая фича идёт вертикальным срезом: `schema → API → shared-типы → web → mobile → тесты`.
3. Контракт API и Zod-схемы — единственный источник истины; изменения проходят через `api-core`.
4. Параллельно можно вести не более 3–4 доменных потоков: `api-core` + `web-shell` + один домен + `qa/devops`.
5. Код-ревью: каждый агент запускает `pnpm typecheck` и свои тесты; Lead — полный `pnpm test && pnpm build` и проверку дизайна.
6. Запрещено: двум агентам одновременно писать в один файл; менять старый сайт `../priznaki`.

## Первый спринт (рекомендация)

- `api-core`: CRUD задач + каталог + тесты (готово), затем `goals/projects/directions`.
- `web-shell` + `web-tasks`: паритет экрана задач (готово в каркасе), затем фильтры/формы.
- `devops-ci`: CI + Docker (готово), затем деплой-среда (Render/Railway + Vercel).
- `qa-autotests`: Playwright на вход и канбан.
- `mobile-expo`: вход + задачи (каркас готов), затем календарь.
