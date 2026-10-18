import { useMemo, useState } from 'react';
import { Activity, Dumbbell, Flame, Footprints, ChevronRight, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppLink } from '@/components/app-link';
import { LABELS, TYPES, consistencyStreak, shiftDate, weekStart, workoutType, type Workout, type WorkoutType } from '@/lib/fitness-dashboard';
import { DEFAULT_GOALS, type Goals, type StrengthSet } from '@/lib/goals';

const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const TYPE_ICONS: Record<WorkoutType, typeof Dumbbell> = { strength_training: Dumbbell, treadmill_running: Activity, indoor_cardio: Activity, running: Footprints, other: Activity };

export function WorkoutsPage({ activities, goals, strengthSets }: { activities: Workout[]; goals: Goals | null; strengthSets: StrengthSet[] }) {
  const today = new Date().toLocaleDateString('en-CA');
  const [filter, setFilter] = useState<WorkoutType | 'all'>('all');
  const list = useMemo(() => activities.filter((a) => a.start_time_local && a.start_time_local.slice(0, 10) <= today && (filter === 'all' || workoutType(a.type) === filter)), [activities, filter, today]);
  const week = weekStart(today);
  const thisWeek = activities.filter((a) => a.start_time_local && a.start_time_local.slice(0, 10) >= week && a.start_time_local.slice(0, 10) <= today);
  const strengthCount = thisWeek.filter((a) => workoutType(a.type) === 'strength_training').length;
  const cardioMinutes = Math.round(thisWeek.filter((a) => ['running', 'treadmill_running', 'indoor_cardio'].includes(workoutType(a.type))).reduce((s, a) => s + (a.duration_seconds ?? 0) / 60, 0));
  const activeKcal = Math.round(thisWeek.reduce((s, a) => s + (a.calories ?? 0), 0));
  const streak = consistencyStreak(activities, today);
  const strengthTarget = goals?.strength_target ?? DEFAULT_GOALS.strength_target;
  const cardioTarget = goals?.cardio_minutes_target ?? DEFAULT_GOALS.cardio_minutes_target;
  const setsByActivity = useMemo(() => { const m = new Map<number, number>(); for (const s of strengthSets) m.set(s.activity_id, (m.get(s.activity_id) ?? 0) + 1); return m; }, [strengthSets]);

  const stats = [
    { label: 'Strength this week', value: `${strengthCount} / ${strengthTarget}`, icon: Dumbbell, ok: strengthCount >= strengthTarget },
    { label: 'Cardio minutes', value: `${cardioMinutes} / ${cardioTarget}`, icon: Activity, ok: cardioMinutes >= cardioTarget },
    { label: 'Active calories', value: activeKcal.toLocaleString(), icon: Flame, ok: true },
    { label: 'Consistency streak', value: `${streak} wk`, icon: ArrowUpRight, ok: streak > 0 },
  ];

  return (
    <div>
      <header className="border-b">
        <div className="mx-auto max-w-5xl px-5 py-6">
          <p className="text-xs font-medium uppercase text-primary">Your training</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Workouts</h1>
          <p className="mt-1 text-sm text-muted-foreground">Week of {dateLabel(week)} · every session, by type</p>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-8 px-5 py-8">
        <section className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className={`border-l-2 pl-4 ${s.ok ? 'border-primary' : 'border-muted-foreground/40'}`}>
              <s.icon className="mb-2 size-4 text-muted-foreground" />
              <p className="text-xl font-bold tabular-nums sm:text-2xl">{s.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </section>

        <section>
          <div className="mb-4 flex flex-wrap gap-2" aria-label="Filter by workout type">
            <Button size="sm" variant={filter === 'all' ? 'secondary' : 'outline'} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All</Button>
            {TYPES.map((t) => (
              <Button key={t} size="sm" variant={filter === t ? 'secondary' : 'outline'} aria-pressed={filter === t} onClick={() => setFilter(t)}>{LABELS[t]}</Button>
            ))}
            <Button size="sm" variant={filter === 'other' ? 'secondary' : 'outline'} aria-pressed={filter === 'other'} onClick={() => setFilter('other')}>Other</Button>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">{list.length} session{list.length === 1 ? '' : 's'}</p>
          <ul className="divide-y rounded-lg border bg-card">
            {list.map((a) => {
              const t = workoutType(a.type);
              const Icon = TYPE_ICONS[t];
              return (
                <li key={a.activity_id}>
                  <AppLink to="/workouts/$id" params={{ id: String(a.activity_id) }} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-accent/40">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-primary/40 text-primary"><Icon className="size-5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{a.name ?? LABELS[t]}</span>
                      <span className="block text-xs text-muted-foreground">
                        {dateLabel(a.start_time_local?.slice(0, 10) ?? today)} · {LABELS[t]}
                        {t === 'strength_training' && setsByActivity.get(a.activity_id) ? ` · ${setsByActivity.get(a.activity_id)} sets logged` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-sm tabular-nums">
                      <span className="block">{a.duration_seconds === null ? '—' : `${Math.round(a.duration_seconds / 60)} min`}</span>
                      <span className="block text-xs text-muted-foreground">{a.calories === null ? '—' : `${Math.round(a.calories)} kcal`} · {a.avg_hr === null ? '—' : `${Math.round(a.avg_hr)} bpm`}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </AppLink>
                </li>
              );
            })}
            {!list.length && <li className="px-5 py-6 text-sm text-muted-foreground">No workouts of this type yet.</li>}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">Streak: consecutive weeks with 3+ workouts; the current week counts once it reaches 3. Tap a session for zones, splits and goal impact.</p>
        </section>
      </main>
    </div>
  );
}
