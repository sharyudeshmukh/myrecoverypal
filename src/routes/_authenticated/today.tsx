import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { useSuspenseQuery, useQueryClient, useQueryErrorResetBoundary } from '@tanstack/react-query';
import { dashboardQuery } from '@/lib/fitness-dashboard.query';
import { TodayPage } from '@/components/today-page';
import { Button } from '@/components/ui/button';
export const Route = createFileRoute("/_authenticated/today")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(dashboardQuery(context.userId));
  },
  head: () => ({
    meta: [
      { title: 'Today — NextRep' },
      { name: 'description', content: "Your next workout recommendation, today's recovery metrics, and goal-driven insights." },
      { property: 'og:title', content: 'Today — NextRep' },
      { property: 'og:description', content: "Next workout, today's recovery, and insights toward losing weight and building muscle." },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: Today,
  pendingComponent: () => <main className="mx-auto max-w-5xl p-8 text-muted-foreground">Loading your day…</main>,
  errorComponent: PageError,
});
function Today() {
  const { userId } = Route.useRouteContext();
  const { data, isFetching } = useSuspenseQuery(dashboardQuery(userId));
  const queryClient = useQueryClient();
  return (
    <TodayPage
      daily={data.daily}
      activities={data.activities}
      goals={data.goals}
      strengthSets={data.strengthSets}
      weightLog={data.weightLog}
      recommendation={data.recommendation}
      busy={isFetching}
      refresh={() => {
        void queryClient.invalidateQueries({ queryKey: ['fitness-dashboard', userId] });
      }}
    />
  );
}
function PageError() {
  const router = useRouter();
  const boundary = useQueryErrorResetBoundary();
  return (
    <main className="mx-auto max-w-md space-y-4 p-8">
      <h1 className="text-2xl font-bold">Your day couldn't be loaded</h1>
      <p className="text-muted-foreground">Try again to reconnect to your Garmin history.</p>
      <Button
        onClick={() => {
          boundary.reset();
          void router.invalidate();
        }}
      >
        Try again
      </Button>
      <p>
        <Link to="/" className="text-sm text-primary">
          Back home
        </Link>
      </p>
    </main>
  );
}
