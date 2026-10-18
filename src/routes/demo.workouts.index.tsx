import { createFileRoute } from '@tanstack/react-router';
import { WorkoutsPage } from '@/components/workouts-page';
import { useDemoData } from '@/lib/demo-context';

export const Route = createFileRoute('/demo/workouts/')({
  head: () => ({
    meta: [
      { title: 'Workouts (demo) — NextRep' },
      { name: 'description', content: 'Every sample session with type filters, weekly targets, and goal impact.' },
      { property: 'og:title', content: 'Workouts (demo) — NextRep' },
      { property: 'og:description', content: 'Sample Garmin sessions, weekly targets, and progress toward the goal.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: DemoWorkouts,
});

function DemoWorkouts() {
  const data = useDemoData();
  return <WorkoutsPage activities={data.activities} goals={data.goals} strengthSets={data.strengthSets} />;
}
