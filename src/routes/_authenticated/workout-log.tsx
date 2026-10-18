import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { dashboardQuery } from '@/lib/fitness-dashboard.query';
import { RecoveryPage } from '@/components/recovery-page';
export const Route = createFileRoute('/_authenticated/workout-log')({
  loader: async ({ context }) => { await context.queryClient.ensureQueryData(dashboardQuery(context.userId)); },
  head: () => ({ meta: [
    { title: 'Recovery — NextRep' },
    { name: 'description', content: 'Automatic muscle recovery estimates from your Garmin exercises and cardio.' },
    { property: 'og:title', content: 'Recovery — NextRep' },
    { property: 'og:description', content: 'See your freshest muscles and the Garmin workouts contributing to fatigue.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
  ] }),
  component: Recovery,
  pendingComponent: () => <main className="mx-auto max-w-5xl p-8 text-muted-foreground">Loading Garmin recovery…</main>,
});
function Recovery() {
  const { userId } = Route.useRouteContext();
  const { data } = useSuspenseQuery(dashboardQuery(userId));
  return <RecoveryPage activities={data.activities} daily={data.daily} />;
}
