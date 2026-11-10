import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task } from '@pb/shared';
import { createTask, patchTask, removeTask, type CreateTaskPayload } from '@/entities/task';
import { useSession } from '@/entities/session';

export function useTaskMutations() {
  const token = useSession((s) => s.token);
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['tasks'] });

  const create = useMutation({
    mutationFn: (payload: CreateTaskPayload) => {
      if (!token) throw new Error('Нет сессии');
      return createTask(token, payload);
    },
    onSuccess: invalidate,
  });

  const move = useMutation({
    mutationFn: (vars: { id: string; status: Task['status']; dueDate?: string | null }) => {
      if (!token) throw new Error('Нет сессии');
      return patchTask(token, vars.id, { status: vars.status, ...(vars.dueDate !== undefined ? { dueDate: vars.dueDate } : {}) });
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => {
      if (!token) throw new Error('Нет сессии');
      return removeTask(token, id);
    },
    onSuccess: invalidate,
  });

  return { create, move, remove };
}
