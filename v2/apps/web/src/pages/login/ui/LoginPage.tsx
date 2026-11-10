import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useSession } from '@/entities/session';
import { credentialsSchema } from '@/features/login/model/credentials';
import { Button, Card, Input } from '@/shared/ui';

export function LoginPage() {
  const token = useSession((s) => s.token);
  const signIn = useSession((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (token) return <Navigate to="/" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = credentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Проверьте поля');
      return;
    }
    setPending(true);
    try {
      await signIn(parsed.data.email, parsed.data.password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось войти');
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-sm space-y-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-accent">ПРИЗНАКИ БЕШЕНСТВА 24</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Вход в штаб</h1>
          <p className="mt-1 text-[12.5px] text-zinc-500">Новая версия на React + Node. Старые данные на месте.</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <label className="block space-y-1.5 text-[12px] text-zinc-400">
            Почта
            <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>
          <label className="block space-y-1.5 text-[12px] text-zinc-400">
            Пароль
            <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
          </label>
          {error ? <p className="text-[12px] text-red-300">{error}</p> : null}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? 'Входим…' : 'Войти'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
