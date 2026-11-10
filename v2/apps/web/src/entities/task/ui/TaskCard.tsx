import type { Task } from '@pb/shared';
import { shortDate } from '@/shared/lib/date';
import { Badge, Card } from '@/shared/ui';

const priorityTone = { low: 'default', medium: 'default', high: 'danger' } as const;
const priorityLabel = { low: 'Низкий', medium: 'Средний', high: 'Высокий' } as const;

type Props = {
  task: Task;
  onMove: (id: string, status: Task['status']) => void;
  onRemove: (id: string) => void;
  moving?: boolean;
};

export function TaskCard({ task, onMove, onRemove, moving }: Props) {
  return (
    <Card className="mb-2 cursor-grab active:cursor-grabbing">
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', task.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        className="space-y-2"
      >
        <div className="flex items-start justify-between gap-2">
          <b className="text-[13px] leading-snug text-zinc-100">{task.title}</b>
          <button
            type="button"
            aria-label="Удалить задачу"
            onClick={() => onRemove(task.id)}
            className="text-zinc-600 transition hover:text-red-400"
          >
            ✕
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
          <Badge>{shortDate(task.dueDate)}</Badge>
          {task.goal ? <Badge tone="accent">◎ {task.goal}</Badge> : null}
          {task.project ? <Badge>📁 {task.project}</Badge> : null}
          <Badge tone={priorityTone[task.priority]}>{priorityLabel[task.priority]}</Badge>
        </div>
        <div className="flex gap-1.5 pt-1">
          {task.status !== 'planned' ? (
            <button
              type="button"
              disabled={moving}
              onClick={() => onMove(task.id, 'planned')}
              className="rounded-lg border border-white/10 px-2 py-1 text-[10.5px] text-zinc-400 hover:bg-white/5"
            >
              ← В план
            </button>
          ) : null}
          {task.status !== 'in_progress' ? (
            <button
              type="button"
              disabled={moving}
              onClick={() => onMove(task.id, 'in_progress')}
              className="rounded-lg border border-white/10 px-2 py-1 text-[10.5px] text-zinc-300 hover:bg-white/5"
            >
              В работу →
            </button>
          ) : null}
          {task.status !== 'done' ? (
            <button
              type="button"
              disabled={moving}
              onClick={() => onMove(task.id, 'done')}
              className="rounded-lg border border-emerald-500/30 px-2 py-1 text-[10.5px] text-emerald-300 hover:bg-emerald-500/10"
            >
              Готово ✓
            </button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
