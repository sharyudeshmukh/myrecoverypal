import { createFileRoute, Link } from '@tanstack/react-router';
import { WorkoutDetail } from '@/components/workout-detail';
import { useDemoData } from '@/lib/demo-context';

export const Route = createFileRoute('/demo/workouts/$id')({
  head: () => ({
    meta: [
      { title: 'Workout detail (demo) — NextRep' },
      { name: 'description', content: 'Heart-rate zones, splits, comparison to the previous session, and goal impact — sample data.' },
      { property: 'og:title', content: 'Workout detail (demo) — NextRep' },
      { property: 'og:description', content: 'Zones, splits, and goal impact — live demo with sample data.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: DemoWorkoutDetail,
});

function DemoWorkoutDetail() {
  const { id } = Route.useParams();
  const data = useDemoData();
  const activityId = Number(id);
  const activity = data.activities.find((a) => a.activity_id === activityId);
  if (!activity) {
    return (
      <main className="mx-auto max-w-md space-y-4 p-8">
        <h1 className="text-2xl font-bold">Workout not found</h1>
        <p className="text-muted-foreground">That sample workout doesn't exist.</p>
        <Link to="/demo/workouts" className="text-sm text-primary">All workouts</Link>
      </main>
    );
  }
  const previous = data.activities
    .filter((a) => a.type === activity.type && a.start_time_local && activity.start_time_local && a.start_time_local < activity.start_time_local)
    .sort((a, b) => (b.start_time_local ?? '').localeCompare(a.start_time_local ?? ''))[0] ?? null;
  const sets = data.strengthSets.filter((s) => s.activity_id === activityId);
  return <WorkoutDetail activity={activity} previous={previous} sets={sets} daily={data.daily} goals={data.goals} onSetsChanged={() => {}} />;
}
