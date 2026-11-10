import { z } from 'zod';

export const taskStatuses = ['planned', 'in_progress', 'done'] as const;
export type TaskStatus = (typeof taskStatuses)[number];

export const taskStatusRu: Record<TaskStatus, string> = {
  planned: 'Запланирована',
  in_progress: 'В работе',
  done: 'Завершена',
};

export const taskPriorities = ['low', 'medium', 'high'] as const;
export type TaskPriority = (typeof taskPriorities)[number];

export const taskPriorityRu: Record<TaskPriority, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
};

export const taskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).default(''),
  status: z.enum(taskStatuses),
  priority: z.enum(taskPriorities),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  area: z.string().max(120).default(''),
  project: z.string().max(200).default(''),
  goal: z.string().max(200).default(''),
  ownerName: z.string().max(120).default(''),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Task = z.infer<typeof taskSchema>;

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1, 'Введите название').max(200),
  description: z.string().max(5000).optional().default(''),
  status: z.enum(taskStatuses).optional().default('planned'),
  priority: z.enum(taskPriorities).optional().default('medium'),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата в формате ГГГГ-ММ-ДД')
    .nullable()
    .optional()
    .default(null),
  area: z.string().max(120).optional().default(''),
  project: z.string().max(200).optional().default(''),
  goal: z.string().max(200).optional().default(''),
});
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;

export const taskUpdateSchema = taskCreateSchema.partial();
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;

export const taskListQuerySchema = z.object({
  status: z.enum(taskStatuses).optional(),
  goal: z.string().max(200).optional(),
  project: z.string().max(200).optional(),
  q: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(100),
});
export type TaskListQuery = z.infer<typeof taskListQuerySchema>;

export const directionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  icon: z.string().default(''),
});
export type Direction = z.infer<typeof directionSchema>;

export const goalSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  dueDate: z.string().nullable(),
  status: z.string().default('active'),
});
export type Goal = z.infer<typeof goalSchema>;

export const projectSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  goal: z.string().default(''),
  dueDate: z.string().nullable(),
  status: z.string().default('active'),
});
export type Project = z.infer<typeof projectSchema>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
