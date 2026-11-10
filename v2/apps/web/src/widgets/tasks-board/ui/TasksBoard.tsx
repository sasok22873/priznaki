import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Task } from '@pb/shared';
import { useSession } from '@/entities/session';
import { fetchTasks, TaskCard } from '@/entities/task';
import { useTaskMutations } from '@/features/task-status';
import { Input, Spinner } from '@/shared/ui';
import { todayIso } from '@/shared/lib/date';

const COLUMNS: Array<{ key: 'backlog' | Task['status']; title: string }> = [
  { key: 'backlog', title: 'Бэклог · без срока' },
  { key: 'planned', title: 'Запланирована' },
  { key: 'in_progress', title: 'В работе' },
  { key: 'done', title: 'Завершена' },
];

export function TasksBoard() {
  const token = useSession((s) => s.token);
  const { move, remove } = useTaskMutations();
  const [search, setSearch] = useState('');
  const [dragOver, setDragOver] = useState<string | null>(null);

  const { data: tasks = [], isLoading, isError, error } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => fetchTasks(token ?? ''),
    enabled: Boolean(token),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? tasks.filter((t) => t.title.toLowerCase().includes(q)) : tasks;
  }, [tasks, search]);

  type ColumnKey = 'backlog' | 'planned' | 'in_progress' | 'done';
  const columns = useMemo(() => {
    const map: Record<ColumnKey, Task[]> = { backlog: [], planned: [], in_progress: [], done: [] };
    for (const task of filtered) {
      if (!task.dueDate && task.status !== 'done') map.backlog.push(task);
      else map[task.status].push(task);
    }
    return map;
  }, [filtered]);

  const handleDrop = (column: 'backlog' | Task['status'], taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (column === 'backlog') {
      move.mutate({ id: taskId, status: 'planned', dueDate: null });
      return;
    }
    if (column === 'in_progress' && !task.dueDate) {
      const ok = window.confirm('У задачи нет срока. Поставить сегодня, чтобы взять в работу?');
      if (!ok) return;
      move.mutate({ id: taskId, status: 'in_progress', dueDate: todayIso() });
      return;
    }
    if (task.status !== column) move.mutate({ id: taskId, status: column });
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <Spinner /> Загружаем задачи…
      </div>
    );
  }
  if (isError) {
    return <div className="text-sm text-red-300">Не удалось загрузить задачи: {(error as Error).message}</div>;
  }

  return (
    <div className="space-y-3">
      <Input
        placeholder="Поиск по задачам…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-xs"
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => (
          <section
            key={col.key}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(col.key);
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(null);
              handleDrop(col.key, e.dataTransfer.getData('text/plain'));
            }}
            className={`min-h-[160px] rounded-xl2 border p-3 transition ${
              dragOver === col.key ? 'border-accent/70 bg-accent-soft' : 'border-white/[0.07] bg-white/[0.02]'
            }`}
          >
            <header className="mb-2 flex items-center justify-between border-b border-white/[0.06] pb-2">
              <b className="text-[12.5px] text-zinc-200">{col.title}</b>
              <span className="rounded-full bg-white/5 px-2 text-[11px] text-zinc-500">{columns[col.key]?.length ?? 0}</span>
            </header>
            {columns[col.key]?.length ? (
              (columns[col.key] ?? []).map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  moving={move.isPending}
                  onMove={(id, status) => handleDrop(status, id)}
                  onRemove={(id) => {
                    if (window.confirm('Удалить задачу?')) remove.mutate(id);
                  }}
                />
              ))
            ) : (
              <p className="py-4 text-center text-[11.5px] text-zinc-600">Пусто</p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
