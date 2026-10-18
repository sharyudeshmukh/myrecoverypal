import { createFileRoute } from '@tanstack/react-router';
import { RecoveryPage } from '@/components/recovery-page';
import { useDemoData } from '@/lib/demo-context';

export const Route = createFileRoute('/demo/workout-log')({
  head: () => ({
    meta: [
      { title: 'Recovery (demo) — NextRep' },
      { name: 'description', content: 'Automatic muscle recovery estimates from sample Garmin exercises and cardio.' },
      { property: 'og:title', content: 'Recovery (demo) — NextRep' },
      { property: 'og:description', content: 'Freshest muscles and the sample workouts contributing to fatigue.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: DemoRecovery,
});

function DemoRecovery() {
  const data = useDemoData();
  return <RecoveryPage activities={data.activities} daily={data.daily} />;
}
