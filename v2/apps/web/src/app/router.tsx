import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from '@/pages/login';
import { TasksPage } from '@/pages/tasks';
import { useSession } from '@/entities/session';
import { Spinner } from '@/shared/ui';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useSession((s) => s.token);
  const ready = useSession((s) => s.ready);
  if (!ready && !token) {
    return (
      <main className="grid min-h-screen place-items-center text-sm text-zinc-400">
        <div className="flex items-center gap-2">
          <Spinner /> Проверяем сессию…
        </div>
      </main>
    );
  }
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <TasksPage />
      </RequireAuth>
    ),
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
