import { createFileRoute } from '@tanstack/react-router';
import { TodayPage } from '@/components/today-page';
import { useDemoData } from '@/lib/demo-context';

export const Route = createFileRoute('/demo/today')({
  head: () => ({
    meta: [
      { title: 'Today (demo) — NextRep' },
      { name: 'description', content: "NextRep's next-workout recommendation, today's metrics, and insights — with sample data." },
      { property: 'og:title', content: 'Today (demo) — NextRep' },
      { property: 'og:description', content: 'Next workout, today’s recovery, and insights — live demo with sample data.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: DemoToday,
});

function DemoToday() {
  const data = useDemoData();
  return <TodayPage daily={data.daily} activities={data.activities} goals={data.goals} strengthSets={data.strengthSets} weightLog={data.weightLog} refresh={() => {}} busy={false} />;
}
