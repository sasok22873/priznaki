import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Task } from '@pb/shared';
import { apiFetch } from '@/shared/api/client';

type TaskListResponse = { data: Task[] };

export function useTasks() {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: () => apiFetch<TaskListResponse>('/tasks').then((r) => r.data),
  });
}

export function useMoveTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; status: Task['status'] }) =>
      apiFetch<Task>(`/tasks/${vars.id}`, { method: 'PATCH', body: JSON.stringify({ status: vars.status }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });
}
