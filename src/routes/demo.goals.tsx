import { createFileRoute } from '@tanstack/react-router';
import { GoalsPage } from '@/components/goals-page';
import { useDemoData } from '@/lib/demo-context';

export const Route = createFileRoute('/demo/goals')({
  head: () => ({
    meta: [
      { title: 'Goals (demo) — NextRep' },
      { name: 'description', content: 'Sample weight target, weekly training targets, and a weight trend chart toward the goal.' },
      { property: 'og:title', content: 'Goals (demo) — NextRep' },
      { property: 'og:description', content: 'Weight target and weekly training targets — live demo with sample data.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: DemoGoals,
});

function DemoGoals() {
  const data = useDemoData();
  return <GoalsPage goals={data.goals} weightLog={data.weightLog} onChanged={() => {}} />;
}
