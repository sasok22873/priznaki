import type { Task as PrismaTask } from '@prisma/client';
import type { Task, TaskStatus } from '@pb/shared';

const STATUS_TO_API: Record<string, TaskStatus> = {
  new: 'planned',
  planned: 'planned',
  in_progress: 'in_progress',
  review: 'in_progress',
  done: 'done',
  cancelled: 'done',
};

const STATUS_TO_DB: Record<TaskStatus, string> = {
  planned: 'planned',
  in_progress: 'in_progress',
  done: 'done',
};

export const STATUS_FILTER_TO_DB: Record<TaskStatus, string[]> = {
  planned: ['planned', 'new'],
  in_progress: ['in_progress', 'review'],
  done: ['done', 'cancelled'],
};

export function mapTask(row: PrismaTask): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    status: STATUS_TO_API[row.status] ?? 'planned',
    priority: (['low', 'medium', 'high'].includes(row.priority) ? row.priority : 'medium') as Task['priority'],
    dueDate: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : null,
    area: row.area ?? '',
    project: row.project ?? '',
    goal: row.goal ?? '',
    ownerName: row.ownerName ?? '',
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function statusToDb(status: TaskStatus): string {
  return STATUS_TO_DB[status];
}

export function dateToDb(value: string | null | undefined): Date | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
}
