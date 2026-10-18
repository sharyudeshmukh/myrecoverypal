import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useSuspenseQuery, useQueryClient, useQueryErrorResetBoundary } from '@tanstack/react-query';
import { dashboardQuery } from '@/lib/fitness-dashboard.query';
import { WorkoutsPage } from '@/components/workouts-page';
import { Button } from '@/components/ui/button';
export const Route = createFileRoute('/_authenticated/workouts/')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(dashboardQuery(context.userId));
  },
  head: () => ({
    meta: [
      { title: 'Workouts — MyRecoveryPal' },
      { name: 'description', content: 'Every recorded session with type filters, weekly targets, and goal impact.' },
      { property: 'og:title', content: 'Workouts — MyRecoveryPal' },
      { property: 'og:description', content: 'Your Garmin sessions, weekly targets, and progress toward your goals.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: Workouts,
  pendingComponent: () => <main className="mx-auto max-w-5xl p-8 text-muted-foreground">Loading your workouts…</main>,
  errorComponent: PageError,
});
function Workouts() {
  const { userId } = Route.useRouteContext();
  const { data } = useSuspenseQuery(dashboardQuery(userId));
  return <WorkoutsPage activities={data.activities} goals={data.goals} strengthSets={data.strengthSets} />;
}
function PageError() {
  const router = useRouter();
  const boundary = useQueryErrorResetBoundary();
  return (
    <main className="mx-auto max-w-md space-y-4 p-8">
      <h1 className="text-2xl font-bold">Your workouts couldn't be loaded</h1>
      <Button onClick={() => { boundary.reset(); void router.invalidate(); }}>Try again</Button>
    </main>
  );
}
