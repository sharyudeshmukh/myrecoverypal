import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { GarminDashboard } from '@/components/garmin-dashboard';
import { useDemoData } from '@/lib/demo-context';

export const Route = createFileRoute('/demo/trends')({
  head: () => ({
    meta: [
      { title: 'Trends (demo) — NextRep' },
      { name: 'description', content: 'Sample Garmin recovery, sleep and movement trends over 30/90 days, plus weekly workouts.' },
      { property: 'og:title', content: 'Trends (demo) — NextRep' },
      { property: 'og:description', content: 'Recovery trends and personalized observations — live demo with sample data.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: DemoTrends,
});

function DemoTrends() {
  const data = useDemoData();
  const [days, setDays] = useState<30 | 90>(90);
  return <GarminDashboard daily={data.daily} activities={data.activities} days={days} onDays={setDays} refresh={() => {}} busy={false} />;
}
