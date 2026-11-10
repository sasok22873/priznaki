import { useState } from 'react';
import { useSession } from '@/entities/session';
import { LoginScreen } from '@/pages/login';
import { TasksScreen } from '@/pages/tasks';

export function RootScreen() {
  const token = useSession((s) => s.token);
  const [signedIn, setSignedIn] = useState(false);
  const isAuthorized = Boolean(token) || signedIn;
  return isAuthorized ? <TasksScreen onSignOut={() => { useSession.getState().signOut(); setSignedIn(false); }} /> : <LoginScreen onSignedIn={() => setSignedIn(true)} />;
}
