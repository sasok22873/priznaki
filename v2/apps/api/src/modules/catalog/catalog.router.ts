import { Router } from 'express';
import type { Db } from '../../shared/db.js';
import { asyncHandler } from '../../shared/http.js';

const isoDate = (value: Date | null): string | null => (value ? value.toISOString().slice(0, 10) : null);

export function createCatalogRouter(db: Db): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      const [directions, goals, projects] = await Promise.all([
        db.direction.findMany({ orderBy: { name: 'asc' } }),
        db.goal.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
        db.project.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
      ]);
      res.json({
        data: {
          directions: directions.map((d) => ({ id: d.id, name: d.name, icon: d.icon })),
          goals: goals.map((g) => ({
            id: g.id,
            title: g.title,
            dueDate: isoDate(g.dueDate),
            status: g.status,
          })),
          projects: projects.map((p) => ({
            id: p.id,
            title: p.title,
            goal: p.goal,
            dueDate: isoDate(p.dueDate),
            status: p.status,
          })),
        },
      });
    }),
  );

  return router;
}
