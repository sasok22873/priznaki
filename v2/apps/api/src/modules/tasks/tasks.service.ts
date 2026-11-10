import type { TaskCreateInput, TaskListQuery, TaskUpdateInput } from '@pb/shared';
import type { Db } from '../../shared/db.js';
import type { RequestUser } from '../../shared/auth-types.js';
import { errors } from '../../shared/errors.js';
import { STATUS_FILTER_TO_DB, dateToDb, mapTask, statusToDb } from './tasks.mapper.js';

function canManage(user: RequestUser, row: { createdBy: string | null; ownerId: string | null }): boolean {
  if (user.role === 'owner') return true;
  return row.createdBy === user.id || row.ownerId === user.id;
}

export async function listTasks(db: Db, query: TaskListQuery) {
  const where: Record<string, unknown> = {};
  if (query.status) where.status = { in: STATUS_FILTER_TO_DB[query.status] };
  if (query.goal) where.goal = query.goal;
  if (query.project) where.project = query.project;
  if (query.q) where.title = { contains: query.q, mode: 'insensitive' };

  const rows = await db.task.findMany({
    where,
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    take: query.limit,
  });
  return rows.map(mapTask);
}

export async function createTask(db: Db, user: RequestUser, input: TaskCreateInput) {
  const row = await db.task.create({
    data: {
      title: input.title,
      description: input.description,
      status: statusToDb(input.status),
      priority: input.priority,
      dueDate: dateToDb(input.dueDate),
      area: input.area,
      project: input.project,
      goal: input.goal,
      ownerName: '',
      ownerId: user.id,
      createdBy: user.id,
    },
  });
  return mapTask(row);
}

export async function updateTask(db: Db, user: RequestUser, id: string, input: TaskUpdateInput) {
  const existing = await db.task.findUnique({ where: { id } });
  if (!existing) throw errors.notFound('Задача не найдена');
  if (!canManage(user, existing)) throw errors.forbidden('Менять задачу может автор или владелец');

  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.status !== undefined) data.status = statusToDb(input.status);
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.dueDate !== undefined) data.dueDate = dateToDb(input.dueDate);
  if (input.area !== undefined) data.area = input.area;
  if (input.project !== undefined) data.project = input.project;
  if (input.goal !== undefined) data.goal = input.goal;
  data.updatedAt = new Date();

  const row = await db.task.update({ where: { id }, data });
  return mapTask(row);
}

export async function deleteTask(db: Db, user: RequestUser, id: string) {
  const existing = await db.task.findUnique({ where: { id } });
  if (!existing) throw errors.notFound('Задача не найдена');
  if (!canManage(user, existing)) throw errors.forbidden('Удалять задачу может автор или владелец');
  await db.task.delete({ where: { id } });
}
