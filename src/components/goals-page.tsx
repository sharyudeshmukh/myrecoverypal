import { useMemo, useState } from 'react';
import { Plus, Scale, Target, Trash2 } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { DEFAULT_GOALS, weightSeries, type Goals, type WeightEntry } from '@/lib/goals';

const tooltipStyle = { background: 'var(--popover)', borderColor: 'var(--border)', color: 'var(--foreground)', borderRadius: 6 };
const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export function GoalsPage({ goals, weightLog, onChanged }: { goals: Goals | null; weightLog: WeightEntry[]; onChanged: () => void }) {
  const today = new Date().toLocaleDateString('en-CA');
  const [form, setForm] = useState({
    goal: goals?.goal ?? DEFAULT_GOALS.goal,
    current_weight: goals?.current_weight ?? null,
    target_weight: goals?.target_weight ?? null,
    units: (goals?.units ?? DEFAULT_GOALS.units) as 'kg' | 'lb',
    age: goals?.age ?? null,
    max_hr: goals?.max_hr ?? null,
    steps_goal: goals?.steps_goal ?? DEFAULT_GOALS.steps_goal,
    strength_target: goals?.strength_target ?? DEFAULT_GOALS.strength_target,
    cardio_minutes_target: goals?.cardio_minutes_target ?? DEFAULT_GOALS.cardio_minutes_target,
  });
  const [weightInput, setWeightInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const series = useMemo(() => weightSeries(weightLog, goals, today, 180), [weightLog, goals, today]);
  const units = form.units;
  const autoMaxHr = form.age != null ? 220 - form.age : null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(''); setSaved(false);
    try {
      const { saveGoals } = await import('@/lib/goals.functions');
      await saveGoals({ data: { ...form, max_hr: form.max_hr ?? autoMaxHr } });
      setSaved(true);
      onChanged();
    } catch (err) { setError(err instanceof Error ? err.message : 'Your goals could not be saved.'); }
    finally { setBusy(false); }
  };
  const addWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    const w = Number(weightInput);
    if (!Number.isFinite(w) || w <= 0) { setError('Enter a valid weight.'); return; }
    setBusy(true); setError('');
    try {
      const { logWeight } = await import('@/lib/goals.functions');
      await logWeight({ data: { date: today, weight: w } });
      setWeightInput('');
      onChanged();
    } catch (err) { setError(err instanceof Error ? err.message : 'Your weight could not be saved.'); }
    finally { setBusy(false); }
  };
  const removeWeight = async (id: string) => {
    setBusy(true);
    try {
      const { deleteWeight } = await import('@/lib/goals.functions');
      await deleteWeight({ data: { id } });
      onChanged();
    } catch (err) { setError(err instanceof Error ? err.message : 'That entry could not be removed.'); }
    finally { setBusy(false); }
  };

  const recent = weightLog.filter((w) => w.date <= today).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  const target = form.target_weight;
  const domain = (() => {
    const values = series.map((s) => s.weight).concat(target != null ? [target] : []);
    if (!values.length) return [0, 100] as [number, number];
    const min = Math.min(...values), max = Math.max(...values);
    return [Math.floor(min - 2), Math.ceil(max + 2)];
  })();

  return (
    <div>
      <header className="border-b">
        <div className="mx-auto max-w-5xl px-5 py-6">
          <p className="text-xs font-medium uppercase text-primary">Lose weight + build muscle</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Goals</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your targets power the next-workout suggestions and insights.</p>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-10 px-5 py-8">
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Scale className="size-4 text-primary" />Weight log</h2>
          <form onSubmit={addWeight} className="mb-5 flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Today's weight ({units})</span>
              <input aria-label="Today's weight" inputMode="decimal" value={weightInput} onChange={(e) => setWeightInput(e.target.value)} className="w-28 rounded-md border bg-input px-3 py-2 text-sm" placeholder="e.g. 74.5" />
            </label>
            <Button type="submit" disabled={busy}><Plus />Log weight</Button>
            {target != null && <p className="pb-2 text-xs text-muted-foreground">Target: {target} {units}</p>}
          </form>
          {series.length >= 2 ? (
            <div className="h-56 rounded-lg border bg-card p-4">
              <ResponsiveContainer>
                <LineChart data={series} margin={{ left: 4, right: 12 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="date" tickFormatter={dateLabel} minTickGap={40} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                  <YAxis domain={domain} width={38} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => dateLabel(String(v))} formatter={(v) => [`${v} ${units}`, 'Weight']} />
                  {target != null && <ReferenceLine y={target} stroke="var(--chart-cardio)" strokeDasharray="4 4" label={{ value: `Target ${target}`, fontSize: 10, fill: 'var(--chart-cardio)', position: 'insideTopRight' }} />}
                  <Line dataKey="weight" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">Log your weight on at least two days to see the trend chart toward your target.</p>
          )}
          {recent.length > 0 && (
            <ul className="mt-4 divide-y rounded-lg border bg-card">
              {recent.map((w) => (
                <li key={w.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">{dateLabel(w.date)}</span>
                  <span className="flex items-center gap-3 tabular-nums">{w.weight} {units}<Button size="icon" variant="ghost" aria-label={`Remove weight from ${w.date}`} disabled={busy} onClick={() => removeWeight(w.id)}><Trash2 /></Button></span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Target className="size-4 text-primary" />Settings</h2>
          {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
          {saved && <p className="mb-4 text-sm text-primary">Goals saved.</p>}
          <form onSubmit={save} className="grid gap-5 rounded-lg border bg-card p-5 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs text-muted-foreground">Goal</span>
              <input aria-label="Goal" value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} className="w-full rounded-md border bg-input px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Current weight ({units})</span>
              <input aria-label="Current weight" inputMode="decimal" value={form.current_weight ?? ''} onChange={(e) => setForm({ ...form, current_weight: e.target.value === '' ? null : Number(e.target.value) })} className="w-full rounded-md border bg-input px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Target weight ({units})</span>
              <input aria-label="Target weight" inputMode="decimal" value={form.target_weight ?? ''} onChange={(e) => setForm({ ...form, target_weight: e.target.value === '' ? null : Number(e.target.value) })} className="w-full rounded-md border bg-input px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Units</span>
              <div className="flex gap-2">
                {(['kg', 'lb'] as const).map((u) => (
                  <Button key={u} type="button" size="sm" variant={form.units === u ? 'secondary' : 'outline'} aria-pressed={form.units === u} onClick={() => setForm({ ...form, units: u })}>{u}</Button>
                ))}
              </div>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Age</span>
              <input aria-label="Age" inputMode="numeric" value={form.age ?? ''} onChange={(e) => setForm({ ...form, age: e.target.value === '' ? null : Number(e.target.value) })} className="w-full rounded-md border bg-input px-3 py-2 text-sm" />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs text-muted-foreground">Max heart rate (bpm)</span>
              <input aria-label="Max heart rate" inputMode="numeric" value={form.max_hr ?? ''} onChange={(e) => setForm({ ...form, max_hr: e.target.value === '' ? null : Number(e.target.value) })} className="w-full rounded-md border bg-input px-3 py-2 text-sm" placeholder={autoMaxHr != null ? `Auto: ${autoMaxHr} (220 − age)` : 'Auto: highest max HR in the last 90 days'} />
              <p className="mt-1 text-xs text-muted-foreground">Leave blank to use {autoMaxHr != null ? `${autoMaxHr} bpm (220 − age)` : 'the highest max HR seen in the last 90 days'} for zone guidance.</p>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Daily steps goal</span>
              <input aria-label="Daily steps goal" inputMode="numeric" value={form.steps_goal} onChange={(e) => setForm({ ...form, steps_goal: Number(e.target.value) || 0 })} className="w-full rounded-md border bg-input px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Weekly strength sessions</span>
              <input aria-label="Weekly strength sessions" inputMode="numeric" value={form.strength_target} onChange={(e) => setForm({ ...form, strength_target: Number(e.target.value) || 0 })} className="w-full rounded-md border bg-input px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Weekly cardio minutes</span>
              <input aria-label="Weekly cardio minutes" inputMode="numeric" value={form.cardio_minutes_target} onChange={(e) => setForm({ ...form, cardio_minutes_target: Number(e.target.value) || 0 })} className="w-full rounded-md border bg-input px-3 py-2 text-sm" />
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save goals'}</Button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
