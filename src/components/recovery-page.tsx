import { useEffect, useState } from 'react';
import { Activity, ArrowUpRight, Battery, Info, HeartPulse } from 'lucide-react';
import { AppLink } from '@/components/app-link';
import { computeGarminRecovery, type MuscleRecovery } from '@/lib/garmin-recovery';
import type { Daily, Workout } from '@/lib/fitness-dashboard';

const tone = (status: MuscleRecovery['status']) => status === 'Fresh' ? 'text-ready' : status === 'Recovering' ? 'text-caution' : 'text-fatigued';
const bar = (status: MuscleRecovery['status']) => status === 'Fresh' ? 'bg-ready' : status === 'Recovering' ? 'bg-caution' : 'bg-fatigued';
export function RecoveryPage({ activities, daily }: { activities: Workout[]; daily: Daily[] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  const recovery = computeGarminRecovery(activities, daily, now);
  return <div>
    <header className="border-b"><div className="mx-auto flex max-w-5xl items-center gap-2 px-5 py-5 font-display font-bold"><AppLink to="/today" className="flex items-center gap-2"><Activity className="size-6 text-primary" />NextRep</AppLink><span className="text-xs font-normal text-muted-foreground">/ RECOVERY</span></div></header>
    <main className="mx-auto max-w-5xl space-y-8 px-5 py-8">
      <section className="border-b pb-7">
        <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-primary"><HeartPulse className="size-4" />Ready to train</p>
        <div className="flex flex-wrap items-start justify-between gap-5"><div className="max-w-xl"><h1 className="text-3xl font-bold capitalize">{recovery.summary}</h1><p className="mt-3 text-sm text-muted-foreground">Estimated from your last 7 days of Garmin workouts · updated automatically</p></div><div><p className="text-5xl font-bold tabular-nums text-primary">{recovery.hasData ? `${recovery.overall}%` : '—'}</p><p className="mt-1 text-xs text-muted-foreground">Overall estimated recovery</p></div></div>
        {recovery.hasData && <p className="mt-5 text-sm"><span className="text-muted-foreground">Freshest groups: </span><span className="capitalize">{recovery.freshest.join(', ')}</span></p>}
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><Battery className="size-4 shrink-0" />{recovery.battery === null ? 'No Body Battery reading today — standard recovery timing.' : `Today's Body Battery: ${recovery.battery}/100 · ${recovery.battery < 40 ? 'recovery timing slowed 25%' : recovery.battery >= 70 ? 'recovery timing slightly accelerated' : 'standard recovery timing'}`}</p>
      </section>
      <section aria-label="Muscle recovery" data-tour="recovery-map" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {recovery.cards.map(card => <article key={card.muscle} className="min-w-0 rounded-lg border bg-card p-5">
          <div className="flex items-center justify-between gap-2"><h2 className="text-lg font-semibold capitalize">{card.muscle}</h2><span className={`text-xs font-semibold ${tone(card.status)}`}>{card.status}</span></div>
          <p className={`mt-4 text-3xl font-bold tabular-nums ${tone(card.status)}`}>{card.recovered}%<span className="ml-2 text-xs font-normal text-muted-foreground">recovered</span></p>
          <div role="progressbar" aria-label={`${card.muscle} recovered`} aria-valuenow={card.recovered} aria-valuemin={0} aria-valuemax={100} className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full ${bar(card.status)} transition-all`} style={{ width: `${card.recovered}%` }} /></div>
          <p className="mt-3 text-xs text-muted-foreground">{card.daysAgo === null ? 'Not worked in the last 7 days' : card.daysAgo < 1 ? 'Last worked less than 1 day ago' : `Last worked ${Math.floor(card.daysAgo)} day${Math.floor(card.daysAgo) === 1 ? '' : 's'} ago`}</p>
          {card.estimated && <p className="mt-3 text-xs leading-relaxed text-caution">estimated — Garmin didn't record exercise names</p>}
          {card.causes.length > 0 && <div className="mt-4 border-t pt-2"><p className="mb-1 text-xs text-muted-foreground">Workouts contributing to fatigue</p>{card.causes.map(cause => <AppLink key={cause.activityId} to="/workouts/$id" params={{ id: String(cause.activityId) }} className="flex min-h-12 items-center justify-between gap-2 rounded-md py-2 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="min-w-0"><span className="block break-words">{cause.name}</span><span className="text-xs text-muted-foreground">{new Date(cause.date.replace(' ', 'T')).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {cause.evidence === 'named' ? 'Named exercises' : cause.evidence === 'cardio' ? 'Cardio estimate' : 'Full-body estimate'}</span></span><ArrowUpRight className="size-4 shrink-0 text-primary" /></AppLink>)}</div>}
        </article>)}
      </section>
      <aside className="flex gap-3 border-y py-5"><Info className="mt-0.5 size-5 shrink-0 text-primary" /><p className="text-sm leading-relaxed text-muted-foreground">Want per-muscle accuracy? Start a Garmin strength workout with named exercises, or edit exercise names in Garmin Connect after a session — NextRep picks them up automatically.</p></aside>
      <footer className="text-xs leading-relaxed text-muted-foreground">Recovery percentages are workload estimates, not measured muscle repair. No workout in the last 7 days means no recent recorded fatigue, not proof of full recovery. Adjust training to how you feel; stop if you have pain.</footer>
    </main>
  </div>;
}