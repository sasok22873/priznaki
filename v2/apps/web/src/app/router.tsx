import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from '@/pages/login';
import { TasksPage } from '@/pages/tasks';
import { useSession } from '@/entities/session';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useSession((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/', element: <RequireAuth><TasksPage /></RequireAuth> },
  { path: '*', element: <Navigate to="/" replace /> },
]);
