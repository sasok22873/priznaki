import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { z } from 'zod';
import { useSession } from '@/entities/session';
import { TasksBoard } from '@/widgets/tasks-board';
import { useTaskMutations } from '@/features/task-status';
import { Button, Card, Input } from '@/shared/ui';

const newTaskSchema = z.object({
  title: z.string().trim().min(1, 'Введите название').max(200),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

export function TasksPage() {
  const token = useSession((s) => s.token);
  const email = useSession((s) => s.email);
  const signOut = useSession((s) => s.signOut);
  const { create } = useTaskMutations();
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!token) return <Navigate to="/login" replace />;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = newTaskSchema.safeParse({ title, dueDate: dueDate || null });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Проверьте поля');
      return;
    }
    create.mutate(
      { title: parsed.data.title, dueDate: parsed.data.dueDate, status: parsed.data.dueDate ? 'planned' : 'planned' },
      {
        onSuccess: () => {
          setTitle('');
          setDueDate('');
        },
        onError: (err) => setError(err instanceof Error ? err.message : 'Не удалось создать'),
      },
    );
  };

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-6 md:px-8">
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">Исполнение</p>
          <h1 className="text-2xl font-semibold tracking-tight">Задачи</h1>
        </div>
        <div className="ml-auto flex items-center gap-2 text-[12px] text-zinc-500">
          {email}
          <Button variant="ghost" onClick={signOut}>
            Выйти
          </Button>
        </div>
      </header>

      <Card className="mb-4">
        <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
          <label className="min-w-[220px] flex-1 space-y-1 text-[12px] text-zinc-400">
            Новая задача
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Что нужно сделать?" />
          </label>
          <label className="space-y-1 text-[12px] text-zinc-400">
            Срок (необязательно)
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Создаём…' : '＋ Создать'}
          </Button>
        </form>
        {error ? <p className="mt-2 text-[12px] text-red-300">{error}</p> : null}
      </Card>

      <TasksBoard />
    </div>
  );
}
