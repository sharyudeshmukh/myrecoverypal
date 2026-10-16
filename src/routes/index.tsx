import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ActivityImportPanel } from "@/components/activity-import-panel";
import { MUSCLES, recoveryFor, hasRecoveryDetails, type Entry, type Muscle } from "@/lib/activity-import";
import { Pencil, Trash2 } from "lucide-react";
import { FitnessJourney } from "@/components/fitness-journey";
import type { Wellness } from "@/lib/garmin";

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

const KEY = "recovery-tracker-entries";

function status(p: number) {
  if (p >= 85) return { label: "Ready", cls: "bg-ready", text: "text-ready" };
  if (p >= 50) return { label: "Recovering", cls: "bg-caution", text: "text-caution" };
  return { label: "Fatigued", cls: "bg-fatigued", text: "text-fatigued" };
}

function Index() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [wellness, setWellness] = useState<Wellness[]>([]);
  const [localEntries, setLocalEntries] = useState<Entry[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [form, setForm] = useState({ type: "Strength", muscles: [] as Muscle[], intensity: 6 as number | null, sleep: 7 as number | null, soreness: 3 as number | null });

  const refresh = useCallback(async () => {
    const {data, error} = await supabase.from("recovery_activities").select("*").order("date", {ascending: false});
    if (error) throw error;
    setEntries(data.map(e => ({...e, muscles: e.muscles.filter((m): m is Muscle => MUSCLES.some(x => x === m))})));
    const result = await supabase.from("garmin_wellness").select("*").order("date");
    if (result.error) throw result.error;
    setWellness(result.data.map(row => {
      const values: Wellness["values"] = {};
      if (row.values && typeof row.values === "object" && !Array.isArray(row.values)) Object.entries(row.values).forEach(([key,value]) => {values[key] = typeof value === "number" ? value : null;});
      return {metric:row.metric,date:row.date,period:row.period,values};
    }));
  }, []);
  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem(KEY) || "[]"); if (Array.isArray(saved)) setLocalEntries(saved); } catch {}
    setLoaded(true);
    const {data: {subscription}} = supabase.auth.onAuthStateChange((_event, session) => setUserId(session?.user.id ?? null));
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => {clearInterval(t); subscription.unsubscribe();};
  }, []);
  useEffect(() => {
    setEditing(null); setError("");
    setWellness([]);
    if (userId) {setEntries([]); refresh().catch(e => setError(e.message));}
    else setEntries(localEntries);
  }, [userId, localEntries, refresh]);
  useEffect(() => { if (loaded) localStorage.setItem(KEY, JSON.stringify(localEntries)); }, [localEntries, loaded]);

  const scores = useMemo(() => MUSCLES.map((m) => ({ m, p: recoveryFor(m, entries, now) })), [entries, now]);
  const overall = Math.round(scores.reduce((a, s) => a + s.p, 0) / scores.length);
  const os = status(overall);
  const measured = entries.some(hasRecoveryDetails);

  const toggle = (m: Muscle) =>
    setForm((f) => ({ ...f, muscles: f.muscles.includes(m) ? f.muscles.filter((x) => x !== m) : [...f.muscles, m] }));

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.muscles.length || form.intensity === null || form.sleep === null || form.soreness === null) return;
    setBusy(true); setError("");
    try {
      if (userId) {
        const result = editing ? await supabase.from("recovery_activities").update(form).eq("id", editing.id) : await supabase.from("recovery_activities").insert({user_id: userId, date: new Date().toISOString(), ...form});
        if (result.error) throw result.error;
        await refresh();
      } else setLocalEntries(prev => editing ? prev.map(x => x.id === editing.id ? {...x, ...form} : x) : [{id: crypto.randomUUID(), date: new Date().toISOString(), ...form}, ...prev]);
      setEditing(null); setForm({type: "Strength", muscles: [], intensity: 6, sleep: 7, soreness: 3});
    } catch (error) {setError(error instanceof Error ? error.message : "Unable to save workout.");}
    finally {setBusy(false);}
  };

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Recovery</p>
          <h1 className="text-4xl font-bold md:text-5xl">How ready are you?</h1>
        </div>
        <div className="text-right">
          <div className={`text-6xl font-bold ${os.text}`} style={{ fontFamily: "var(--font-display)" }}>{measured ? `${overall}%` : "—"}</div>
          <p className="text-sm text-muted-foreground">{measured ? `Overall · ${os.label}` : "Recovery details needed"}</p>
        </div>
      </header>

      <FitnessJourney entries={entries} wellness={wellness} />
      <h2 className="mb-4 mt-8 text-xl font-semibold">Muscle recovery · estimated from your logs</h2>
      <section className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {scores.map(({ m, p }) => {
          const s = status(p);
          const tracked = entries.some(e => hasRecoveryDetails(e) && e.muscles.includes(m));
          return (
            <div key={m} className="rounded-xl border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-medium">{m}</span>
                <span className={`text-xs ${s.text}`}>{tracked ? s.label : "No data"}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className={`h-full ${s.cls} transition-all`} style={{ width: `${tracked ? p : 0}%` }} />
              </div>
              <p className="mt-2 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{tracked ? `${p}%` : "—"}</p>
            </div>
          );
        })}
      </section>

      {userId && <div className="mb-3 flex justify-end"><Button variant="ghost" onClick={() => supabase.auth.signOut()}>Sign out</Button></div>}
      <ActivityImportPanel userId={userId} refresh={refresh} />
      {error && <p role="alert" className="mb-4 text-destructive">{error}</p>}
      <div className="grid gap-6 md:grid-cols-2">
        <form onSubmit={add} className="space-y-5 rounded-xl border bg-card p-5">
          <h2 className="text-xl font-semibold">{editing ? "Recovery details" : "Log a workout"}</h2>
          {editing && <p className="text-sm text-muted-foreground">{editing.title || editing.type} · {editing.date.slice(0,10)}</p>}
          <select
            aria-label="Workout type"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full rounded-md border bg-input px-3 py-2"
          >
            {Array.from(new Set(["Strength", "Cardio", "HIIT", "Sports", "Mobility", form.type])).map((t) => <option key={t}>{t}</option>)}
          </select>
          <div>
            <p className="mb-2 text-sm text-muted-foreground">Muscles worked</p>
            <div className="flex flex-wrap gap-2">
              {MUSCLES.map((m) => (
                <Button
                  type="button"
                  key={m}
                  variant={form.muscles.includes(m) ? "default" : "outline"}
                  aria-pressed={form.muscles.includes(m)}
                  onClick={() => toggle(m)}
                  className={`rounded-full border px-3 py-1 text-sm transition ${form.muscles.includes(m) ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                >
                  {m}
                </Button>
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
                <span className="font-medium">{form[k] === null ? "Not recorded" : `${form[k]}${unit}`}</span>
              </div>
              <input
                type="range" min={min} max={max} step={step} value={form[k] ?? min}
                onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })}
                className="w-full accent-[var(--primary)]"
              />
            </label>
          ))}
          <Button
            disabled={busy || !form.muscles.length || form.intensity === null || form.sleep === null || form.soreness === null}
            className="w-full rounded-md bg-primary py-2.5 font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "Saving…" : editing ? "Save recovery details" : "Save workout"}
          </Button>
          {editing && <Button type="button" variant="ghost" onClick={() => {setEditing(null); setForm({type: "Strength", muscles: [], intensity: 6, sleep: 7, soreness: 3});}}>Cancel</Button>}
        </form>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-xl font-semibold">History · {entries.length}</h2>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No workouts yet. Log your first one to see recovery.</p>
          ) : (
            <ul className="max-h-[480px] space-y-3 overflow-auto">
              {entries.map((e) => (
                <li key={e.id} className="rounded-lg bg-muted p-3">
                  <div className="flex items-center justify-between">
                    <span className="min-w-0 break-words font-medium">{e.title || e.type}</span>
                    <div className="flex shrink-0 gap-1">
                      <Button size="icon" variant="ghost" aria-label={`Edit ${e.title || e.type}`} title="Edit recovery details" onClick={() => {setEditing(e); setForm({type: e.type, muscles: e.muscles, intensity: e.intensity, sleep: e.sleep, soreness: e.soreness}); document.querySelector("form")?.scrollIntoView({block: "center"});}}><Pencil /></Button>
                      <Button size="icon" variant="ghost" disabled={busy} aria-label={`Remove ${e.title || e.type}`} title="Remove activity" onClick={async () => {
                        setBusy(true); setError("");
                        try {if (userId) {const {error} = await supabase.from("recovery_activities").delete().eq("id",e.id); if (error) throw error; await refresh();} else setLocalEntries(p => p.filter(x => x.id !== e.id));}
                        catch (error) {setError(error instanceof Error ? error.message : "Unable to remove activity.");} finally {setBusy(false);}
                      }}><Trash2 /></Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(e.date).toLocaleString()} · RPE {e.intensity ?? "—"} · {e.sleep ?? "—"}h sleep · soreness {e.soreness ?? "—"}
                  </p>
                  {e.duration && <p className="mt-1 text-xs text-muted-foreground">{e.duration} · {e.avg_hr ?? "—"} bpm · {e.calories ?? "—"} kcal</p>}
                  <p className="mt-1 text-sm">{hasRecoveryDetails(e) ? e.muscles.join(", ") : "Recovery details needed"}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
