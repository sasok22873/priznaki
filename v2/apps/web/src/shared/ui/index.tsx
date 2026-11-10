import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const styles =
    variant === 'primary'
      ? 'bg-accent text-ink-950 hover:opacity-90'
      : variant === 'danger'
        ? 'border border-red-500/40 text-red-300 hover:bg-red-500/10'
        : 'border border-white/10 text-zinc-200 hover:bg-white/5';
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        styles,
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-xl2 border border-white/[0.07] bg-ink-850 p-4', className)}>{children}</div>;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-accent/60',
        className,
      )}
      {...props}
    />
  );
}

export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'accent' | 'danger' }) {
  const styles =
    tone === 'accent'
      ? 'border-accent/40 text-accent'
      : tone === 'danger'
        ? 'border-red-500/40 text-red-300'
        : 'border-white/10 text-zinc-400';
  return <span className={cn('rounded-full border px-2 py-0.5 text-[10.5px]', styles)}>{children}</span>;
}

export function Spinner() {
  return (
    <span
      aria-label="Загрузка"
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-accent"
    />
  );
}
