import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { useSuspenseQuery, useQueryClient, useQueryErrorResetBoundary } from '@tanstack/react-query';
import { dashboardQuery, workoutDetailQuery } from '@/lib/fitness-dashboard.query';
import { WorkoutDetail } from '@/components/workout-detail';
import { Button } from '@/components/ui/button';
export const Route = createFileRoute('/_authenticated/workouts/$id')({
  loader: async ({ context, params }) => {
    const id = Number(params.id);
    if (!Number.isInteger(id)) throw new Error('Invalid workout.');
    await Promise.all([context.queryClient.ensureQueryData(dashboardQuery(context.userId)), context.queryClient.ensureQueryData(workoutDetailQuery(id))]);
  },
  head: () => ({
    meta: [
      { title: 'Workout detail — NextRep' },
      { name: 'description', content: 'Heart-rate zones, splits, comparison to your last session, and goal impact.' },
      { property: 'og:title', content: 'Workout detail — NextRep' },
      { property: 'og:description', content: 'Zones, splits, and what this session did for your goals.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: Detail,
  pendingComponent: () => <main className="mx-auto max-w-5xl p-8 text-muted-foreground">Loading this workout…</main>,
  errorComponent: DetailError,
});
function Detail() {
  const { id } = Route.useParams();
  const { userId } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const { data: detail } = useSuspenseQuery(workoutDetailQuery(Number(id)));
  const { data: dash } = useSuspenseQuery(dashboardQuery(userId));
  return (
    <WorkoutDetail
      activity={detail.activity}
      previous={detail.previous}
      sets={detail.sets}
      daily={dash.daily}
      goals={dash.goals}
      onSetsChanged={() => {
        void queryClient.invalidateQueries({ queryKey: ['workout-detail', Number(id)] });
        void queryClient.invalidateQueries({ queryKey: ['fitness-dashboard', userId] });
      }}
    />
  );
}
function DetailError() {
  const router = useRouter();
  const boundary = useQueryErrorResetBoundary();
  return (
    <main className="mx-auto max-w-md space-y-4 p-8">
      <h1 className="text-2xl font-bold">This workout couldn't be loaded</h1>
      <p className="text-muted-foreground">It may have been removed, or the reading is unavailable.</p>
      <Button onClick={() => { boundary.reset(); void router.invalidate(); }}>Try again</Button>
      <p><Link to="/workouts" className="text-sm text-primary">All workouts</Link></p>
    </main>
  );
}
