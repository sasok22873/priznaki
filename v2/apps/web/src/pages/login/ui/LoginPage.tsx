import { Navigate } from 'react-router-dom';
import { useSession } from '@/entities/session';
import { keycloakLogin } from '@/shared/keycloak';
import { Button, Card, Spinner } from '@/shared/ui';

export function LoginPage() {
  const token = useSession((s) => s.token);
  const ready = useSession((s) => s.ready);

  if (token) return <Navigate to="/" replace />;

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-sm space-y-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-accent">ПРИЗНАКИ БЕШЕНСТВА 24</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Вход в штаб</h1>
          <p className="mt-1 text-[12.5px] text-zinc-500">
            Вход через Keycloak. Учётную запись выдаёт владелец штаба.
          </p>
        </div>

        <Button className="w-full" onClick={keycloakLogin} disabled={!ready}>
          {ready ? 'Войти через Keycloak' : 'Подключаемся к Keycloak…'}
        </Button>
        {!ready ? (
          <p className="flex items-center gap-2 text-[12px] text-zinc-500">
            <Spinner /> Проверяем сервер авторизации
          </p>
        ) : null}

        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-[11.5px] leading-relaxed text-zinc-500">
          <p className="text-zinc-400">Локальные пользователи (realm priznaki):</p>
          <p className="mt-1">owner / owner123 — владелец</p>
          <p>member / member123 — участник</p>
          <p>viewer / viewer123 — наблюдатель</p>
        </div>
      </Card>
    </main>
  );
}
