import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import { useMemo } from 'react';
import { LogIn, X } from 'lucide-react';
import { generateDemoData } from '@/lib/demo-data';
import { DemoDataProvider, DemoModeProvider } from '@/lib/demo-context';
import { AppNav } from '@/components/app-nav';
import { DemoTour } from '@/components/demo-tour';
import { Toaster } from '@/components/ui/sonner';

export const Route = createFileRoute('/demo')({
  ssr: false,
  head: () => ({
    meta: [
      { title: 'Live demo — NextRep' },
      { name: 'description', content: 'Explore NextRep with realistic sample data — no account needed. Recovery, trends, and goal-driven workout suggestions.' },
      { property: 'og:title', content: 'Live demo — NextRep' },
      { property: 'og:description', content: 'Try the full NextRep experience with realistic sample data — no sign-up.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: DemoShell,
});

function DemoShell() {
  const data = useMemo(() => generateDemoData(new Date().toLocaleDateString('en-CA')), []);
  const latestStrength = data.activities.filter((a) => a.type === 'strength_training').at(-1);
  return (
    <DemoModeProvider>
      <DemoDataProvider value={data}>
        <div className="min-h-screen pb-20">
          <div className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 border-b border-primary/40 bg-primary/15 px-4 py-1.5 text-center text-xs backdrop-blur">
            <span className="font-semibold text-primary">Demo mode</span>
            <span className="text-muted-foreground">Realistic sample data, not a real person's health records</span>
            <span className="flex items-center gap-3">
              <Link to="/" className="flex items-center gap-1 font-semibold text-primary hover:underline"><X className="size-3" />Exit demo</Link>
              <Link to="/auth" className="flex items-center gap-1 font-semibold text-primary hover:underline"><LogIn className="size-3" />Sign in</Link>
            </span>
          </div>
          <Outlet />
          <AppNav />
          <DemoTour workoutId={latestStrength?.activity_id ?? 0} />
          <Toaster position="bottom-center" />
        </div>
      </DemoDataProvider>
    </DemoModeProvider>
  );
}
