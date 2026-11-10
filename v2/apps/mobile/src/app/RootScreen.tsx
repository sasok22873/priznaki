import { useSession } from '@/entities/session';
import { LoginScreen } from '@/pages/login';
import { TasksScreen } from '@/pages/tasks';

export function RootScreen() {
  const token = useSession((s) => s.token);
  return token ? <TasksScreen onSignOut={() => useSession.getState().signOut()} /> : <LoginScreen />;
}
