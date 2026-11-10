import { describe, expect, it, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import type { Db } from '../src/shared/db.js';
import type { AuthVerifier } from '../src/shared/auth-types.js';

type TaskRow = {
  id: string;
  title: string;
  description: string;
  result: string;
  note: string;
  area: string;
  project: string;
  goal: string;
  ownerName: string;
  ownerId: string | null;
  createdBy: string | null;
  dueDate: Date | null;
  dueTime: string;
  priority: string;
  status: string;
  budgetPlanned: unknown;
  icon: string;
  createdAt: Date;
  updatedAt: Date;
};

const baseTask = (over: Partial<TaskRow>): TaskRow => ({
  id: crypto.randomUUID(),
  title: 'Задача',
  description: '',
  result: '',
  note: '',
  area: '',
  project: '',
  goal: '',
  ownerName: '',
  ownerId: null,
  createdBy: null,
  dueDate: null,
  dueTime: '',
  priority: 'medium',
  status: 'planned',
  budgetPlanned: null,
  icon: '',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...over,
});

function createFakeDb(seed: TaskRow[] = []) {
  const tasks = [...seed];
  const db = {
    task: {
      findMany: vi.fn(async () => tasks),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => tasks.find((t) => t.id === where.id) ?? null),
      create: vi.fn(async ({ data }: { data: Partial<TaskRow> }) => {
        const row = baseTask({ ...data, id: crypto.randomUUID() });
        tasks.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<TaskRow> }) => {
        const row = tasks.find((t) => t.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data);
        return row;
      }),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        const index = tasks.findIndex((t) => t.id === where.id);
        if (index >= 0) tasks.splice(index, 1);
        return {} as TaskRow;
      }),
    },
    direction: { findMany: vi.fn(async () => [{ id: crypto.randomUUID(), name: 'Создание песен', icon: '' }]) },
    goal: { findMany: vi.fn(async () => []) },
    project: { findMany: vi.fn(async () => []) },
  };
  return { db: db as unknown as Db, tasks, raw: db };
}

/** Фейковый верификатор: эмулирует результат проверки Keycloak-токена */
const users: Record<string, { id: string; email: string; role: 'owner' | 'member' | 'viewer'; name: string }> = {
  'token-member': { id: 'user-member', email: 'member@example.com', role: 'member', name: 'Участник' },
  'token-owner': { id: 'user-owner', email: 'owner@example.com', role: 'owner', name: 'Владелец' },
  'token-viewer': { id: 'user-viewer', email: 'viewer@example.com', role: 'viewer', name: 'Наблюдатель' },
};

const verifyToken: AuthVerifier = async (token) => {
  const user = users[token];
  if (!user) throw new Error('bad token');
  return user;
};

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('API', () => {
  let fake: ReturnType<typeof createFakeDb>;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    fake = createFakeDb([
      baseTask({ id: '11111111-1111-4111-8111-111111111111', title: 'Чужая', status: 'review', createdBy: 'other-user' }),
      baseTask({ id: '22222222-2222-4222-8222-222222222222', title: 'Моя', status: 'new', createdBy: 'user-member', ownerId: 'user-member' }),
    ]);
    app = createApp({ db: fake.db, verifyToken });
  });

  it('health отвечает ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('без токена — 401', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('/api/me отдаёт пользователя и роль из токена', async () => {
    const res = await request(app).get('/api/me').set(auth('token-member'));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ email: 'member@example.com', role: 'member' });
  });

  it('возвращает задачи и маппит старые статусы', async () => {
    const res = await request(app).get('/api/tasks').set(auth('token-member'));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].status).toBe('in_progress');
    expect(res.body.data[1].status).toBe('planned');
  });

  it('создаёт задачу с валидацией Zod', async () => {
    const bad = await request(app).post('/api/tasks').set(auth('token-member')).send({ title: '' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');

    const ok = await request(app)
      .post('/api/tasks')
      .set(auth('token-member'))
      .send({ title: 'Новая задача', dueDate: '2026-12-01' });
    expect(ok.status).toBe(201);
    expect(ok.body.data.title).toBe('Новая задача');
    expect(ok.body.data.status).toBe('planned');
  });

  it('наблюдатель не может создавать', async () => {
    const res = await request(app).post('/api/tasks').set(auth('token-viewer')).send({ title: 'Нельзя' });
    expect(res.status).toBe(403);
  });

  it('участник меняет свою и не может чужую', async () => {
    const own = await request(app)
      .patch('/api/tasks/22222222-2222-4222-8222-222222222222')
      .set(auth('token-member'))
      .send({ status: 'in_progress' });
    expect(own.status).toBe(200);
    expect(own.body.data.status).toBe('in_progress');

    const foreign = await request(app)
      .patch('/api/tasks/11111111-1111-4111-8111-111111111111')
      .set(auth('token-member'))
      .send({ status: 'done' });
    expect(foreign.status).toBe(403);
  });

  it('владелец удаляет чужую, участник — нет', async () => {
    const denied = await request(app).delete('/api/tasks/11111111-1111-4111-8111-111111111111').set(auth('token-member'));
    expect(denied.status).toBe(403);

    const ok = await request(app).delete('/api/tasks/11111111-1111-4111-8111-111111111111').set(auth('token-owner'));
    expect(ok.status).toBe(204);
  });

  it('каталог отдаёт направления/цели/проекты', async () => {
    const res = await request(app).get('/api/catalog').set(auth('token-member'));
    expect(res.status).toBe(200);
    expect(res.body.data.directions).toHaveLength(1);
    expect(Array.isArray(res.body.data.goals)).toBe(true);
  });
});
