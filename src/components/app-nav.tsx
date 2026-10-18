import { Link, useRouterState } from '@tanstack/react-router';
import { CalendarCheck, Dumbbell, LineChart, Target, HeartPulse } from 'lucide-react';

const items = [
  { to: '/today', label: 'Today', icon: CalendarCheck },
  { to: '/workouts', label: 'Workouts', icon: Dumbbell },
  { to: '/trends', label: 'Trends', icon: LineChart },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/workout-log', label: 'Recovery', icon: HeartPulse },
] as const;

export function AppNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);
  return (
    <nav aria-label="Main navigation" className="app-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur">
      <div className="mx-auto grid min-h-16 max-w-3xl grid-cols-5 items-stretch gap-1 px-2">
        {items.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            aria-current={isActive(to) ? 'page' : undefined}
            className={`relative my-1 flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg text-xs font-semibold transition motion-safe:active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${isActive(to) ? 'bg-primary/15 text-primary' : 'text-foreground/70 hover:bg-accent hover:text-foreground'}`}
          >
            {isActive(to) && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />}
            <Icon className="size-6" />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
