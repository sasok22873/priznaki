import { Router } from 'express';
import { taskCreateSchema, taskListQuerySchema, taskUpdateSchema } from '@pb/shared';
import type { Db } from '../../shared/db.js';
import { asyncHandler } from '../../shared/http.js';
import { requireWriter } from '../../middleware/auth.js';
import { createTask, deleteTask, listTasks, updateTask } from './tasks.service.js';

export function createTasksRouter(db: Db): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const query = taskListQuerySchema.parse(req.query);
      res.json({ data: await listTasks(db, query) });
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const user = requireWriter(req);
      const input = taskCreateSchema.parse(req.body);
      res.status(201).json({ data: await createTask(db, user, input) });
    }),
  );

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      const user = requireWriter(req);
      const input = taskUpdateSchema.parse(req.body);
      res.json({ data: await updateTask(db, user, String(req.params.id), input) });
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const user = requireWriter(req);
      await deleteTask(db, user, String(req.params.id));
      res.status(204).send();
    }),
  );

  return router;
}
