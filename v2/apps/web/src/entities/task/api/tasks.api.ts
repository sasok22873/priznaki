import { z } from 'zod';
import type { Task } from '@pb/shared';
import { apiFetch } from '@/shared/api/client';

const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.enum(['planned', 'in_progress', 'done']),
  priority: z.enum(['low', 'medium', 'high']),
  dueDate: z.string().nullable(),
  area: z.string(),
  project: z.string(),
  goal: z.string(),
  ownerName: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const taskListSchema = z.object({ data: z.array(taskSchema) });
const taskOneSchema = z.object({ data: taskSchema });

export async function fetchTasks(token: string): Promise<Task[]> {
  const res = await apiFetch<unknown>('/tasks', { token });
  return taskListSchema.parse(res).data;
}

export type CreateTaskPayload = {
  title: string;
  description?: string;
  status?: Task['status'];
  priority?: Task['priority'];
  dueDate?: string | null;
  goal?: string;
  project?: string;
};

export async function createTask(token: string, payload: CreateTaskPayload): Promise<Task> {
  const res = await apiFetch<unknown>('/tasks', { method: 'POST', body: payload, token });
  return taskOneSchema.parse(res).data;
}

export async function patchTask(
  token: string,
  id: string,
  payload: Partial<CreateTaskPayload>,
): Promise<Task> {
  const res = await apiFetch<unknown>(`/tasks/${id}`, { method: 'PATCH', body: payload, token });
  return taskOneSchema.parse(res).data;
}

export async function removeTask(token: string, id: string): Promise<void> {
  await apiFetch<void>(`/tasks/${id}`, { method: 'DELETE', token });
}
