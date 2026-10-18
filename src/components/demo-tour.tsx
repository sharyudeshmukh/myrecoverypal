import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const KEY = 'nextrep-demo-tour-v1';

export function DemoTour({ workoutId }: { workoutId: number }) {
  const navigate = useNavigate();
  const [step, setStep] = useState<number | null>(() => (typeof window === 'undefined' || window.localStorage.getItem(KEY) ? null : 0));

  const steps = [
    {
      route: '/demo/today',
      target: '[data-tour="next-workout"]',
      title: 'Your next workout, decided for you',
      text: 'A rule-based engine reads recovery, Body Battery, sleep and your weekly targets to pick today\u2019s session \u2014 with the reasons why.',
    },
    {
      route: '/demo/workout-log',
      target: '[data-tour="recovery-map"]',
      title: 'Automatic muscle recovery',
      text: 'Muscle fatigue is estimated straight from Garmin exercises \u2014 no manual logging. Legs are still recovering from yesterday; upper body is fresh.',
    },
    {
      route: `/demo/workouts/${workoutId}`,
      target: '[data-tour="workout-zones"]',
      title: 'Every session, decoded',
      text: 'Heart-rate zones, splits, comparison with your last session, and what it did for the weight-loss + muscle-building goal.',
    },
  ];

  useEffect(() => {
    if (step === null) return;
    const current = steps[step];
    if (!current) return;
    void navigate({ to: current.route as never });
    const timer = setTimeout(() => {
      document.querySelectorAll('.demo-tour-target').forEach((el) => el.classList.remove('demo-tour-target'));
      const el = document.querySelector(current.target);
      if (el) {
        el.classList.add('demo-tour-target');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const dismiss = () => {
    window.localStorage.setItem(KEY, '1');
    document.querySelectorAll('.demo-tour-target').forEach((el) => el.classList.remove('demo-tour-target'));
    setStep(null);
  };

  if (step === null) return null;
  const current = steps[step];
  if (!current) return null;

  return (
    <div role="dialog" aria-label="Demo tour" className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm rounded-xl border border-primary/50 bg-card p-4 shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase text-primary">Demo tour · step {step + 1} of {steps.length}</p>
        <button onClick={dismiss} aria-label="Dismiss tour" className="text-muted-foreground transition-colors hover:text-foreground"><X className="size-4" /></button>
      </div>
      <h2 className="mt-2 font-semibold">{current.title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{current.text}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <Button size="sm" variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
        <Button size="sm" onClick={() => (step === steps.length - 1 ? dismiss() : setStep(step + 1))}>
          {step === steps.length - 1 ? 'Got it' : 'Next'}
        </Button>
      </div>
    </div>
  );
}
