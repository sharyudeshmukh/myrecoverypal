import { useState } from 'react';
import { ArrowLeft, Clock, Flame, MapPin, Plus, Trash2, Gauge } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AppLink } from '@/components/app-link';
import { DEMO_TOAST, useDemoMode } from '@/lib/demo-context';
import { LABELS, workoutType, type Daily, type Workout } from '@/lib/fitness-dashboard';
import { HR_ZONES, avgPaceMinPerKm, effectiveMaxHr, exerciseOptions, goalNote, muscleForExercise, progressiveOverload, splits, timeInZones, type Goals, type StrengthSet } from '@/lib/goals';
import type { Tables } from '@/integrations/supabase/types';

const tooltipStyle = { background: 'var(--popover)', borderColor: 'var(--border)', color: 'var(--foreground)', borderRadius: 6 };
const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const fmt = (v: number | null | undefined, unit = '', digits = 0) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : `${v.toLocaleString(undefined, { maximumFractionDigits: digits })}${unit}`);
const pace = (min: number | null) => (min === null ? '—' : `${Math.floor(min)}:${String(Math.round((min % 1) * 60)).padStart(2, '0')} /km`);

function Stat({ label, value, sub }: { label: string; value: string; sub?: string | undefined }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
function delta(now: number | null, before: number | null, unit: string, invert = false) {
  if (now === null || before === null) return null;
  const d = now - before;
  if (Math.abs(d) < 0.05) return 'same as last time';
  const better = invert ? d < 0 : d > 0;
  return `${d > 0 ? '+' : ''}${d.toFixed(unit === ' min' ? 0 : 1)}${unit} vs last time (${better ? 'up' : 'down'})`;
}

export function WorkoutDetail({ activity, previous, sets, daily, goals, onSetsChanged }: { activity: Tables<'garmin_activities'>; previous: Tables<'garmin_activities'> | null; sets: StrengthSet[]; daily: Daily[]; goals: Goals | null; onSetsChanged: () => void }) {
  const demo = useDemoMode();
  const today = new Date().toLocaleDateString('en-CA');
  const t = workoutType(activity.type);
  const isRun = t === 'running' || t === 'treadmill_running';
  const maxHr = effectiveMaxHr(goals, daily, today);
  const zones = timeInZones(activity as Workout);
  const zoneData = zones.map((z) => ({ ...z, label: `Z${z.zone}`, name: HR_ZONES.find((x) => x.zone === z.zone)?.label ?? '' }));
  const hasZones = zones.some((z) => z.minutes > 0);
  const laps = splits(activity as Workout);
  const raw = activity.raw as Record<string, unknown> | null;
  const movingSeconds = typeof raw?.['movingDuration'] === 'number' ? (raw['movingDuration'] as number) : null;
  const totalSets = typeof raw?.['activeSets'] === 'number' ? (raw['activeSets'] as number) : null;
  const totalReps = typeof raw?.['totalReps'] === 'number' ? (raw['totalReps'] as number) : null;
  const note = goalNote(activity as Workout, daily, maxHr);

  const [exercise, setExercise] = useState('');
  const [suggestions, setSuggestions] = useState(false);
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showAllSets, setShowAllSets] = useState(false);

  const overload = progressiveOverload(sets, [activity as Workout], today);
  const options = exercise.trim() ? exerciseOptions(exercise) : [];

  const addSet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (demo) { toast(DEMO_TOAST); return; }
    const muscle = muscleForExercise(exercise);
    if (!exercise.trim() || !muscle) { setError('Pick an exercise from the list so we can map it to a muscle group.'); return; }
    setBusy(true); setError('');
    try {
      const { addStrengthSet } = await import('@/lib/goals.functions');
      const nextNumber = sets.filter((s) => s.exercise === exercise.trim()).length + 1;
      await addStrengthSet({ data: { activity_id: activity.activity_id, exercise: exercise.trim(), muscle_group: muscle, set_number: nextNumber, reps: reps ? Number(reps) : null, weight: weight ? Number(weight) : null } });
      setReps(''); setWeight('');
      onSetsChanged();
    } catch (err) { setError(err instanceof Error ? err.message : 'That set could not be saved.'); }
    finally { setBusy(false); }
  };
  const removeSet = async (id: string) => {
    if (demo) { toast(DEMO_TOAST); return; }
    setBusy(true); setError('');
    try {
      const { deleteStrengthSet } = await import('@/lib/goals.functions');
      await deleteStrengthSet({ data: { id } });
      onSetsChanged();
    } catch (err) { setError(err instanceof Error ? err.message : 'That set could not be removed.'); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <header className="border-b">
        <div className="mx-auto max-w-5xl px-5 py-6">
          <AppLink to="/workouts" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />All workouts</AppLink>
          <p className="text-xs font-medium uppercase text-primary">{LABELS[t]}</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{activity.name ?? LABELS[t]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{dateLabel(activity.start_time_local?.slice(0, 10) ?? today)}</p>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-8 px-5 py-8">
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Duration" value={activity.duration_seconds === null ? '—' : `${Math.round(activity.duration_seconds / 60)} min`} sub={movingSeconds !== null ? `${Math.round(movingSeconds / 60)} min moving` : undefined} />
          <Stat label="Calories" value={fmt(activity.calories, ' kcal')} />
          <Stat label="Avg HR" value={fmt(activity.avg_hr, ' bpm')} />
          <Stat label="Max HR" value={fmt(activity.max_hr, ' bpm')} />
          {isRun ? (
            <>
              <Stat label="Distance" value={activity.distance_meters === null ? '—' : `${(activity.distance_meters / 1000).toFixed(2)} km`} />
              <Stat label="Avg pace" value={pace(avgPaceMinPerKm(activity as Workout))} />
            </>
          ) : (
            <>
              <Stat label="Distance" value={activity.distance_meters === null ? '—' : `${(activity.distance_meters / 1000).toFixed(2)} km`} />
              <Stat label={t === 'strength_training' ? 'Sets · reps' : 'Elevation'} value={t === 'strength_training' ? `${fmt(totalSets)} · ${fmt(totalReps)}` : fmt(activity.elevation_gain, ' m')} />
            </>
          )}
        </section>

        <section className="rounded-lg border-l-2 border-primary bg-card p-5">
          <p className="text-xs font-semibold uppercase text-primary">What this did for your goal</p>
          <p className="mt-2 text-sm leading-relaxed">{note}</p>
        </section>

        {hasZones && (
          <section data-tour="workout-zones">
            <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold"><Gauge className="size-4 text-primary" />Time in heart-rate zones</h2>
            <p className="mb-4 text-xs text-muted-foreground">Max HR {Math.round(maxHr)} bpm{goals?.max_hr == null && goals?.age == null ? ' (from your recent workouts)' : ''}</p>
            <div className="h-52 rounded-lg border bg-card p-4">
              <ResponsiveContainer>
                <BarChart data={zoneData}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <YAxis width={34} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Math.round(Number(v))} min`, 'Time']} labelFormatter={(l) => `${l} · ${zoneData.find((z) => z.label === l)?.name ?? ''}`} />
                  <Bar dataKey="minutes" fill="var(--primary)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {laps.length > 0 && (
          <section>
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold"><MapPin className="size-4 text-primary" />Splits</h2>
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full min-w-80 text-left text-sm">
                <thead className="text-xs text-muted-foreground"><tr><th className="px-4 py-3 font-normal">Split</th><th className="px-4 py-3 font-normal">Distance</th><th className="px-4 py-3 font-normal">Pace</th><th className="px-4 py-3 text-right font-normal">Avg HR</th></tr></thead>
                <tbody>
                  {laps.map((l) => (
                    <tr key={l.index} className="border-t"><td className="px-4 py-2.5">{l.index}</td><td className="px-4 py-2.5 tabular-nums">{l.distanceKm === null ? '—' : `${l.distanceKm.toFixed(2)} km`}</td><td className="px-4 py-2.5 tabular-nums">{pace(l.paceMinPerKm)}</td><td className="px-4 py-2.5 text-right tabular-nums">{fmt(l.avgHr, ' bpm')}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {previous && (
          <section>
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Clock className="size-4 text-primary" />Compared to your last {LABELS[t].toLowerCase()} session</h2>
            <div className="rounded-lg border bg-card p-5">
              <p className="mb-3 text-xs text-muted-foreground">{dateLabel(previous.start_time_local?.slice(0, 10) ?? today)} · {previous.name ?? LABELS[t]}</p>
              <ul className="space-y-2 text-sm">
                {delta(activity.duration_seconds === null ? null : activity.duration_seconds / 60, previous.duration_seconds === null ? null : previous.duration_seconds / 60, ' min') && <li>Duration: {delta(activity.duration_seconds === null ? null : activity.duration_seconds / 60, previous.duration_seconds === null ? null : previous.duration_seconds / 60, ' min')}</li>}
                {delta(activity.calories, previous.calories, ' kcal') && <li>Calories: {delta(activity.calories, previous.calories, ' kcal')}</li>}
                {delta(activity.avg_hr, previous.avg_hr, ' bpm', true) && <li>Avg HR: {delta(activity.avg_hr, previous.avg_hr, ' bpm', true)}</li>}
                {isRun && delta(avgPaceMinPerKm(activity as Workout), avgPaceMinPerKm(previous as Workout), ' min', true) && <li>Pace: {delta(avgPaceMinPerKm(activity as Workout), avgPaceMinPerKm(previous as Workout), ' min', true)}</li>}
              </ul>
            </div>
          </section>
        )}

        {t === 'strength_training' && (
          <section>
            <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold"><Plus className="size-4 text-primary" />Strength log</h2>
            <p className="mb-4 text-xs text-muted-foreground">Garmin records limited set detail — add your exercises to track muscle volume and progressive overload.</p>
            {overload.length > 0 && (
              <div className="mb-4 rounded-md border border-primary/40 bg-card p-4">
                <p className="text-xs font-semibold uppercase text-primary">Progress callout</p>
                <ul className="mt-2 space-y-1 text-sm">{overload.map((o) => <li key={o}>{o}</li>)}</ul>
              </div>
            )}
            <form onSubmit={addSet} className="mb-5 grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_auto_auto_auto]">
              <div className="relative">
                <input
                  aria-label="Exercise name"
                  placeholder="Search exercise (e.g. Squat)"
                  value={exercise}
                  onChange={(e) => { setExercise(e.target.value); setSuggestions(true); }}
                  onFocus={() => setSuggestions(true)}
                  onBlur={() => setTimeout(() => setSuggestions(false), 150)}
                  className="w-full rounded-md border bg-input px-3 py-2 text-sm"
                />
                {suggestions && options.length > 0 && exercise.trim() && (
                  <ul className="absolute z-20 mt-1 max-h-44 w-full overflow-auto rounded-md border bg-popover shadow-md">
                    {options.map((o) => (
                      <li key={o.exercise}>
                        <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => { setExercise(o.exercise); setSuggestions(false); }}>
                          {o.exercise}<span className="text-xs capitalize text-muted-foreground">{o.muscle}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <input aria-label="Reps" placeholder="Reps" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} className="w-20 rounded-md border bg-input px-3 py-2 text-sm" />
              <input aria-label="Weight" placeholder="Weight" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} className="w-24 rounded-md border bg-input px-3 py-2 text-sm" />
              <Button type="submit" disabled={busy}>Add set</Button>
            </form>
            {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
            {sets.length > 0 ? (
              <ul className="divide-y rounded-lg border bg-card">
                {(showAllSets ? sets : sets.slice(0, 8)).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="min-w-0"><span className="block truncate font-medium">{s.exercise}</span><span className="text-xs capitalize text-muted-foreground">{s.muscle_group} · set {s.set_number}</span></span>
                    <span className="flex shrink-0 items-center gap-3 tabular-nums text-muted-foreground">{fmt(s.reps)} reps × {fmt(s.weight)}</span>
                    <Button size="icon" variant="ghost" aria-label={`Remove ${s.exercise} set ${s.set_number}`} disabled={busy} onClick={() => removeSet(s.id)}><Trash2 /></Button>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">No sets logged for this session yet.</p>}
            {sets.length > 8 && !showAllSets && <Button variant="ghost" className="mt-2" onClick={() => setShowAllSets(true)}>Show all {sets.length} sets</Button>}
          </section>
        )}

        <footer className="flex items-center gap-2 border-t pt-5 text-xs text-muted-foreground"><Flame className="size-3.5" />Activity ID {activity.activity_id} · General fitness guidance, not medical advice.</footer>
      </main>
    </div>
  );
}
