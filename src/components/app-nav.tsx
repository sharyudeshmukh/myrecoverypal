import { Link, useRouterState } from '@tanstack/react-router';
import { CalendarCheck, Dumbbell, LineChart, Target, HeartPulse } from 'lucide-react';

const items = [
  { to: '/today', label: 'Today', icon: CalendarCheck },
  { to: '/workouts', label: 'Workouts', icon: Dumbbell },
  { to: '/trends', label: 'Trends', icon: LineChart },
  { to: '/goals', label: 'Goals', icon: Target },
] as const;

export function AppNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);
  return (
    <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-stretch justify-between px-2">
        {items.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            aria-current={isActive(to) ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${isActive(to) ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        ))}
        <Link
          to="/workout-log"
          aria-current={isActive('/workout-log') ? 'page' : undefined}
          className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${isActive('/workout-log') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <HeartPulse className="size-5" />
          Recovery
        </Link>
      </div>
    </nav>
  );
}
