import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useSuspenseQuery, useQueryClient, useQueryErrorResetBoundary } from '@tanstack/react-query';
import { dashboardQuery } from '@/lib/fitness-dashboard.query';
import { GoalsPage } from '@/components/goals-page';
import { Button } from '@/components/ui/button';
export const Route = createFileRoute('/_authenticated/goals')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(dashboardQuery(context.userId));
  },
  head: () => ({
    meta: [
      { title: 'Goals — MyRecoveryPal' },
      { name: 'description', content: 'Set your weight target, step goal, and weekly training targets, and log your weight.' },
      { property: 'og:title', content: 'Goals — MyRecoveryPal' },
      { property: 'og:description', content: 'Weight target, weekly training targets, and weight trend chart.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: Goals,
  pendingComponent: () => <main className="mx-auto max-w-5xl p-8 text-muted-foreground">Loading your goals…</main>,
  errorComponent: PageError,
});
function Goals() {
  const { userId } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(dashboardQuery(userId));
  return (
    <GoalsPage
      goals={data.goals}
      weightLog={data.weightLog}
      onChanged={() => {
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
      <h1 className="text-2xl font-bold">Your goals couldn't be loaded</h1>
      <Button onClick={() => { boundary.reset(); void router.invalidate(); }}>Try again</Button>
    </main>
  );
}
