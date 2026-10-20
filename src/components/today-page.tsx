import { Activity, ArrowRight, Battery, BedDouble, Flame, Footprints, Heart, LogOut, Moon, RefreshCw, Sparkles, Waves, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppLink } from '@/components/app-link';
import { supabase } from '@/integrations/supabase/client';
import { useDemoMode } from '@/lib/demo-context';
import { Sparkline } from '@/components/sparkline';
import { OVERNIGHT, average, shiftDate, type Daily, type Workout } from '@/lib/fitness-dashboard';
import { DEFAULT_GOALS, goalInsights, nextWorkout, rawStats, type Goals, type StrengthSet, type WeightEntry, type NextWorkout } from '@/lib/goals';
import { useEffect, useState, type ReactNode } from 'react';
import { computeGarminRecovery } from '@/lib/garmin-recovery';

const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fmt = (v: number | null | undefined, unit = '', digits = 0) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : `${v.toLocaleString(undefined, { maximumFractionDigits: digits })}${unit}`);

function Tile({ icon: Icon, label, value, detail, avgLabel, spark, children }: { icon: typeof Heart; label: string; value: string; detail: string; avgLabel: string; spark: (number | null)[]; children?: ReactNode }) {
  return (
    <article className="min-w-0 rounded-lg border bg-card p-5">
      <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground"><Icon className="size-4 text-primary" />{label}</div>
      <p className="text-3xl font-bold tabular-nums">{value}</p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{detail}</p>
      <div className="mt-4 flex items-end justify-between gap-2 border-t pt-3">
        <p className="text-[11px] text-muted-foreground">{avgLabel}</p>
        <Sparkline values={spark} />
      </div>
      {children}
    </article>
  );
}

export function TodayPage({ daily, activities, goals, strengthSets, weightLog = [], refresh, busy, recommendation }: { daily: Daily[]; activities: Workout[]; goals: Goals | null; strengthSets: StrengthSet[]; weightLog?: WeightEntry[]; refresh: () => void; busy: boolean; recommendation?: NextWorkout | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  const demo = useDemoMode();
  const today = pacificToday(now);
  const recovery = computeGarminRecovery(activities, daily, now);
  const sorted = daily.filter((d) => d.date <= today).sort((a, b) => b.date.localeCompare(a.date));
  const current = sorted.find((d) => d.date === today);
  const week7 = sorted.filter((d) => d.date >= shiftDate(today, -6));
  const next = recommendation ?? nextWorkout(daily, activities, goals, strengthSets, today, now);
  const insights = goalInsights(daily, activities, weightLog, strengthSets, goals, today);
  const stepsGoal = goals?.steps_goal ?? DEFAULT_GOALS.steps_goal;
  const units = goals?.units ?? 'kg';

  const stats = current ? rawStats(current) : {};
  const batteryNow = (() => {
    for (const d of sorted.slice(0, 3)) {
      const v = rawStats(d).bodyBatteryMostRecentValue;
      if (typeof v === 'number' && Number.isFinite(v)) return v;
    }
    return current?.body_battery_high ?? null;
  })();
  const noSleep = current?.sleep_seconds === null || current?.sleep_seconds === undefined;
  const series = (pick: (d: Daily) => number | null) => week7.map(pick).reverse();

  const kcalSpark = series((d) => rawStats(d).totalKilocalories ?? null);
  const stepsSpark = series((d) => d.steps);
  const hrSpark = series((d) => (d.sleep_seconds === null ? null : d.resting_hr));
  const batterySpark = series((d) => d.body_battery_high);
  const stressSpark = series((d) => (d.stress_avg != null && d.stress_avg >= 0 ? d.stress_avg : null));

  const whyTone = next.type === 'recovery' ? 'text-fatigued' : next.type === 'strength' ? 'text-ready' : 'text-caution';
  const typeLabel = next.type === 'recovery' ? 'RECOVERY DAY' : next.type === 'strength' ? 'STRENGTH' : 'CARDIO';

  return (
    <div>
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-5">
          <AppLink to="/today" className="flex items-center gap-2 font-display text-base font-bold">
            <Activity className="size-6 text-primary" />NextRep<span className="hidden text-xs font-normal text-muted-foreground sm:inline">/ {DEFAULT_GOALS.goal.toUpperCase()}</span>
          </AppLink>
          <div className="flex items-center gap-2">
            {!demo && (
              <>
                <Button variant="outline" size="icon" title="Refresh Garmin readings" aria-label="Refresh Garmin readings" disabled={busy} onClick={refresh}>
                  <RefreshCw className={busy ? 'animate-spin' : ''} />
                </Button>
                <Button title="Sign out" aria-label="Sign out" variant="ghost" size="icon" onClick={async () => { await supabase.auth.signOut(); }}>
                  <LogOut />
                </Button>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-10 px-5 py-8">
        <section data-tour="next-workout">
          <p className="mb-2 text-xs font-medium uppercase text-primary">Today / next workout{recommendation ? ' · frozen recommendation' : ''}</p>
          <div className="rounded-xl border border-primary/40 bg-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className={`text-xs font-semibold ${whyTone}`}>{typeLabel}</p>
                <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{next.title}</h1>
                <p className="mt-2 text-sm text-muted-foreground">{next.duration} · {next.intensity}</p>
              </div>
              <AppLink to="/workout-log" className="flex items-center gap-1 text-sm text-primary">Recovery<ArrowRight className="size-4" /></AppLink>
            </div>
            {next.muscleGroups?.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {next.muscleGroups.map((m) => (
                  <span key={m} className="rounded-full border border-primary/40 px-3 py-1 text-xs capitalize text-primary">{m}</span>
                ))}
              </div>
            ) : null}
            <AppLink to="/workout-log" className="mt-4 block text-sm text-primary">{recovery.summary}</AppLink>
            <ul className="mt-5 space-y-2 border-t pt-4">
              {next.why.map((w, i) => (
                <li key={i} className="flex gap-2 text-sm text-muted-foreground"><Zap className="mt-0.5 size-3.5 shrink-0 text-primary" />{w}</li>
              ))}
            </ul>
            <div className="mt-4 rounded-md bg-muted px-4 py-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Low energy alternative</p>
              <p className="mt-1 text-sm">{next.lowEnergy}</p>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-t pt-4 text-sm">
              <span className="flex items-center gap-2"><Footprints className="size-4 text-primary" />Today's steps target: <strong className="tabular-nums">{stepsGoal.toLocaleString()}</strong></span>
              {noSleep && <span className="flex items-center gap-2 text-muted-foreground"><BedDouble className="size-4" />{OVERNIGHT}</span>}
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold"><span className="size-2 rounded-full bg-primary" />Today's metrics</h2>
          {!current && <p className="mb-5 text-sm text-muted-foreground">No Garmin readings for today yet. Latest recorded day: {sorted[0]?.date ?? 'none yet'}.</p>}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Tile
              icon={Flame}
              label="Calories"
              value={fmt(stats.totalKilocalories, ' kcal')}
              detail={`Active ${fmt(stats.activeKilocalories, ' kcal')} · BMR ${fmt(stats.bmrKilocalories, ' kcal')}. Totals read low on days the watch isn't worn all day.`}
              avgLabel={`7-day avg ${fmt(average(kcalSpark), ' kcal')}`}
              spark={kcalSpark}
            />
            <Tile
              icon={Footprints}
              label="Steps"
              value={fmt(current?.steps)}
              detail={`Goal ${stepsGoal.toLocaleString()}${current?.steps != null ? ` · ${Math.round((current.steps / stepsGoal) * 100)}% reached` : ''}`}
              avgLabel={`7-day avg ${fmt(average(stepsSpark))}`}
              spark={stepsSpark}
            >
              {current?.steps != null && (
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${Math.min(100, (current.steps / stepsGoal) * 100)}%` }} />
                </div>
              )}
            </Tile>
            <Tile
              icon={Heart}
              label="Heart rate"
              value={current?.resting_hr != null && !noSleep ? `${Math.round(current.resting_hr)} bpm` : '—'}
              detail={noSleep ? 'Resting HR flagged unreliable — ' + OVERNIGHT : `Resting · today ${fmt(stats.minHeartRate)}–${fmt(stats.maxHeartRate)} bpm`}
              avgLabel={`7-day avg ${fmt(average(hrSpark), ' bpm')}`}
              spark={hrSpark}
            />
            <Tile
              icon={Battery}
              label="Body Battery"
              value={batteryNow === null ? '—' : `${Math.round(batteryNow)} / 100`}
              detail={`High ${fmt(current?.body_battery_high)} · low ${fmt(current?.body_battery_low)}`}
              avgLabel={`7-day avg high ${fmt(average(batterySpark))}`}
              spark={batterySpark}
            />
            <Tile
              icon={Waves}
              label="Stress"
              value={current?.stress_avg != null && current.stress_avg >= 0 ? `${Math.round(current.stress_avg)} / 100` : '—'}
              detail={`Max ${fmt(current?.stress_max)} · missing readings excluded`}
              avgLabel={`7-day avg ${fmt(average(stressSpark))}`}
              spark={stressSpark}
            />
            <Tile
              icon={Moon}
              label="Sleep"
              value={noSleep ? '—' : `${((current?.sleep_seconds ?? 0) / 3600).toFixed(1)} h`}
              detail={noSleep ? OVERNIGHT : 'Recorded overnight'}
              avgLabel={`7-day avg ${fmt(average(series((d) => (d.sleep_seconds === null ? null : d.sleep_seconds / 3600))), ' h', 1)}`}
              spark={series((d) => (d.sleep_seconds === null ? null : d.sleep_seconds / 3600))}
            />
          </div>
        </section>

        <section>
          <div className="mb-6 flex items-center gap-2"><Sparkles className="size-5 text-primary" /><h2 className="text-xl font-bold">Your insights</h2></div>
          <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {insights.insights.map((o) => (
              <article key={o.title} className="border-t pt-4">
                <h3 className="text-sm font-semibold">{o.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{o.text}</p>
              </article>
            ))}
          </div>
          <div className="mt-7 border-l-2 border-primary pl-5">
            <p className="text-xs font-semibold uppercase text-primary">Your next move</p>
            <p className="mt-2 text-sm leading-relaxed">{insights.recommendation}</p>
          </div>
        </section>
        <footer className="border-t pt-5 text-xs leading-relaxed text-muted-foreground">Goal: {goals?.goal ?? DEFAULT_GOALS.goal} · Weight in {units} · Garmin measurements — missing readings are never treated as zero. General fitness guidance, not medical advice.</footer>
      </main>
    </div>
  );
}
