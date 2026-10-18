import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useSuspenseQuery, useQueryClient, useQueryErrorResetBoundary } from '@tanstack/react-query';
import { dashboardQuery } from '@/lib/fitness-dashboard.query';
import { GarminDashboard } from '@/components/garmin-dashboard';
import { Button } from '@/components/ui/button';
export const Route = createFileRoute('/_authenticated/trends')({
  validateSearch: (search: Record<string, unknown>): { days: 30 | 90 } => ({ days: Number(search['days']) === 90 ? 90 : 30 }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(dashboardQuery(context.userId));
  },
  head: () => ({
    meta: [
      { title: 'Trends — MyRecoveryPal' },
      { name: 'description', content: 'Your daily Garmin recovery, sleep and movement trends, and weekly workouts.' },
      { property: 'og:title', content: 'Trends — MyRecoveryPal' },
      { property: 'og:description', content: 'Private Garmin recovery trends and personalized fitness observations.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: Trends,
  pendingComponent: () => <main className="mx-auto max-w-7xl p-8 text-muted-foreground">Loading your Garmin readings…</main>,
  errorComponent: DashboardError,
  notFoundComponent: () => <main className="p-8">No trends found.</main>,
});
function Trends() {
  const { userId } = Route.useRouteContext();
  const { days } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data, isFetching } = useSuspenseQuery(dashboardQuery(userId));
  const queryClient = useQueryClient();
  return (
    <GarminDashboard
      daily={data.daily}
      activities={data.activities}
      days={days}
      onDays={(days) => {
        void navigate({ search: { days } });
      }}
      busy={isFetching}
      refresh={() => {
        void queryClient.invalidateQueries({ queryKey: ['fitness-dashboard', userId] });
      }}
    />
  );
}
function DashboardError() {
  const router = useRouter();
  const boundary = useQueryErrorResetBoundary();
  return (
    <main className="mx-auto max-w-md space-y-4 p-8">
      <h1 className="text-2xl font-bold">Your readings couldn't be loaded</h1>
      <p className="text-muted-foreground">Try again to reconnect to your Garmin history.</p>
      <Button
        onClick={() => {
          boundary.reset();
          void router.invalidate();
        }}
      >
        Try again
      </Button>
    </main>
  );
}
