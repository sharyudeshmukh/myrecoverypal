import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Recovery Tracker — Know when to train" },
      { name: "description", content: "Log workouts, sleep and soreness to see which muscles are recovered and ready." },
      { property: "og:title", content: "Recovery Tracker" },
      { property: "og:description", content: "See which muscles are recovered and ready to train." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const MUSCLES = ["Chest", "Back", "Shoulders", "Arms", "Core", "Quads", "Hamstrings", "Glutes", "Calves"] as const;
type Muscle = (typeof MUSCLES)[number];

type Entry = {
  id: string;
  date: string; // ISO
  type: string;
  muscles: Muscle[];
  intensity: number; // 1-10
  sleep: number; // hours
  soreness: number; // 1-10
};

const KEY = "recovery-tracker-entries";

// Recovery hours needed scales with intensity; poor sleep slows recovery.
function recoveryFor(muscle: Muscle, entries: Entry[], now: number) {
  let worst = 100;
  for (const e of entries) {
    if (!e.muscles.includes(muscle)) continue;
    const hoursSince = (now - new Date(e.date).getTime()) / 36e5;
    const sleepFactor = e.sleep >= 7 ? 1 : 1 + (7 - e.sleep) * 0.1;
    const needed = (24 + e.intensity * 6 + e.soreness * 2) * sleepFactor;
    const pct = Math.max(0, Math.min(100, (hoursSince / needed) * 100));
    worst = Math.min(worst, pct);
  }
  return Math.round(worst);
}

function status(p: number) {
  if (p >= 85) return { label: "Ready", cls: "bg-ready", text: "text-ready" };
  if (p >= 50) return { label: "Recovering", cls: "bg-caution", text: "text-caution" };
  return { label: "Fatigued", cls: "bg-fatigued", text: "text-fatigued" };
}

function Index() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [form, setForm] = useState({ type: "Strength", muscles: [] as Muscle[], intensity: 6, sleep: 7, soreness: 3 });

  useEffect(() => {
    try { setEntries(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch {}
    setLoaded(true);
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (loaded) localStorage.setItem(KEY, JSON.stringify(entries)); }, [entries, loaded]);

  const scores = useMemo(() => MUSCLES.map((m) => ({ m, p: recoveryFor(m, entries, now) })), [entries, now]);
  const overall = Math.round(scores.reduce((a, s) => a + s.p, 0) / scores.length);
  const os = status(overall);

  const toggle = (m: Muscle) =>
    setForm((f) => ({ ...f, muscles: f.muscles.includes(m) ? f.muscles.filter((x) => x !== m) : [...f.muscles, m] }));

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.muscles.length) return;
    setEntries((prev) => [{ id: crypto.randomUUID(), date: new Date().toISOString(), ...form }, ...prev]);
    setForm((f) => ({ ...f, muscles: [] }));
  };

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Recovery</p>
          <h1 className="text-4xl font-bold md:text-5xl">How ready are you?</h1>
        </div>
        <div className="text-right">
          <div className={`text-6xl font-bold ${os.text}`} style={{ fontFamily: "var(--font-display)" }}>{overall}%</div>
          <p className="text-sm text-muted-foreground">Overall · {os.label}</p>
        </div>
      </header>

      <section className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {scores.map(({ m, p }) => {
          const s = status(p);
          return (
            <div key={m} className="rounded-xl border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-medium">{m}</span>
                <span className={`text-xs ${s.text}`}>{s.label}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className={`h-full ${s.cls} transition-all`} style={{ width: `${p}%` }} />
              </div>
              <p className="mt-2 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{p}%</p>
            </div>
          );
        })}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <form onSubmit={add} className="space-y-5 rounded-xl border bg-card p-5">
          <h2 className="text-xl font-semibold">Log a workout</h2>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full rounded-md border bg-input px-3 py-2"
          >
            {["Strength", "Cardio", "HIIT", "Sports", "Mobility"].map((t) => <option key={t}>{t}</option>)}
          </select>
          <div>
            <p className="mb-2 text-sm text-muted-foreground">Muscles worked</p>
            <div className="flex flex-wrap gap-2">
              {MUSCLES.map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => toggle(m)}
                  className={`rounded-full border px-3 py-1 text-sm transition ${form.muscles.includes(m) ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          {([
            ["intensity", "Intensity", 1, 10, 1, ""],
            ["sleep", "Sleep last night", 3, 12, 0.5, "h"],
            ["soreness", "Soreness", 1, 10, 1, ""],
          ] as const).map(([k, label, min, max, step, unit]) => (
            <label key={k} className="block">
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{form[k]}{unit}</span>
              </div>
              <input
                type="range" min={min} max={max} step={step} value={form[k]}
                onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })}
                className="w-full accent-[var(--primary)]"
              />
            </label>
          ))}
          <button
            disabled={!form.muscles.length}
            className="w-full rounded-md bg-primary py-2.5 font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            Save workout
          </button>
        </form>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-xl font-semibold">History</h2>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No workouts yet. Log your first one to see recovery.</p>
          ) : (
            <ul className="max-h-[480px] space-y-3 overflow-auto">
              {entries.map((e) => (
                <li key={e.id} className="rounded-lg bg-muted p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{e.type}</span>
                    <button
                      onClick={() => setEntries((p) => p.filter((x) => x.id !== e.id))}
                      className="text-xs text-muted-foreground hover:text-destructive"
                    >
                      Remove
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(e.date).toLocaleString()} · RPE {e.intensity} · {e.sleep}h sleep · soreness {e.soreness}
                  </p>
                  <p className="mt-1 text-sm">{e.muscles.join(", ")}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
