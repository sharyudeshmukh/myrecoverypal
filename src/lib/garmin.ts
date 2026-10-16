import Papa from "papaparse";
import { parseActivities, type Entry } from "./activity-import";

export type Wellness = { metric: string; period: string; date: string; values: Record<string, number | null> };
export type GarminImport = { activities: ReturnType<typeof parseActivities>; wellness: Wellness[] };
export function parseGarmin(text: string): GarminImport {
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), { skipEmptyLines: "greedy" });
  if (parsed.errors.length) throw new Error("Unable to read this Garmin CSV.");
  const rows = parsed.data;
  const first = rows[0] ?? [];
  if (first.includes("Activity Type")) return { activities: parseActivities(text), wellness: [] };
  const metric = first.includes("Daily High") ? "Body Battery" : first.includes("Resting Heart Rate") ? "Resting heart rate" : first.includes("Stress") ? "Stress" : first.includes("Active Calories") ? "Calories" : first.includes("Climbed Floors") ? "Floors" : first.includes("Actual") ? "Steps" : first[0]?.includes("Intensity Minutes") ? "Intensity minutes" : first[0]?.includes("VO₂ Max") ? "VO₂ max" : null;
  if (!metric) throw new Error("This file is not a supported Garmin export.");
  const header = metric === "Intensity minutes" || metric === "VO₂ max" ? rows[1] ?? [] : first;
  const body = rows.slice(metric === "Intensity minutes" || metric === "VO₂ max" ? 2 : 1);
  const wellness = body.map(row => {
    const raw = row[0] ?? "";
    let date: string;
    if (metric === "VO₂ max") {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const [month, year] = raw.split(" ");
      const index = months.findIndex(m => m === month);
      if (index < 0 || !year || !/^\d{4}$/.test(year)) throw new Error("Invalid VO₂ max month.");
      date = `${year}-${String(index + 1).padStart(2, "0")}-01`;
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
      const [month, day, year] = raw.split("/"); date = `${year}-${month}-${day}`;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) date = raw;
    else throw new Error("A Garmin row has an unrecognized date.");
    const values: Wellness["values"] = {};
    if (metric === "VO₂ max") values["VO₂ Max"] = number(row[2]);
    else header.slice(1).forEach((key, i) => { if (key) values[key] = number(row[i + 1]); });
    return { metric, date, period: metric === "Body Battery" ? "daily" : metric === "VO₂ max" ? "monthly" : "weekly", values };
  });
  return { activities: [], wellness };
}
function number(value: string | undefined) {
  if (!value || value === "--") return null;
  const n = Number(value.replaceAll(",", "")); return Number.isFinite(n) ? n : null;
}
export function mergeGarmin(imports: GarminImport[]): GarminImport {
  const activities = new Map<string, GarminImport["activities"][number]>();
  const wellness = new Map<string, Wellness>();
  for (const data of imports) {
    data.activities.forEach(a => activities.set(a.source_key, a));
    data.wellness.forEach(w => wellness.set(`${w.metric}:${w.date}`, w));
  }
  return {activities: [...activities.values()], wellness: [...wellness.values()]};
}
export function fitnessInsights(entries: Entry[], wellness: Wellness[], today: string) {
  const end = new Date(`${today}T23:59:59`).getTime();
  const start = end - 365 * 864e5;
  const activities = entries.filter(e => {const t = new Date(e.date).getTime(); return t > start && t <= end;});
  const data = wellness.filter(w => new Date(w.date).getTime() > start && w.date <= today).sort((a,b) => a.date.localeCompare(b.date));
  const series = (metric: string, key: string) => data.filter(w => w.metric === metric && w.values[key] !== null && w.values[key] !== undefined).map(w => ({date: w.date, value: w.values[key] ?? 0}));
  const vo2 = series("VO₂ max", "VO₂ Max");
  const rhr = series("Resting heart rate", "Resting Heart Rate");
  const stress = series("Stress", "Stress");
  const battery = data.filter(w => w.metric === "Body Battery");
  const steps = series("Steps", "Actual");
  const intensity = data.filter(w => w.metric === "Intensity minutes");
  const recent = activities.filter(e => new Date(e.date).getTime() > end - 28 * 864e5);
  const previous = activities.filter(e => { const t = new Date(e.date).getTime(); return t > end - 56 * 864e5 && t <= end - 28 * 864e5; });
  const avg = (values: number[]) => values.length ? values.reduce((a,b) => a+b,0) / values.length : null;
  const lastBattery = battery.at(-1);
  const freshBattery = lastBattery && end - new Date(lastBattery.date).getTime() < 2 * 864e5 ? lastBattery : null;
  const latestVo2 = vo2.at(-1);
  const firstVo2 = vo2[0];
  const baselineRhr = avg(rhr.slice(-9,-1).map(r => r.value));
  const latestRhr = rhr.at(-1);
  const latestStress = stress.at(-1);
  const notes: {title: string; text: string; tone: "ready" | "caution" | "neutral"}[] = [];
  if (latestVo2 && firstVo2 && vo2.length > 1) {
    const delta = latestVo2.value - firstVo2.value;
    notes.push({title: delta >= 0 ? "Aerobic fitness is building" : "Aerobic fitness has eased", text: `Your recorded VO₂ max moved from ${firstVo2.value} to ${latestVo2.value} (${delta >= 0 ? "+" : ""}${delta.toFixed(1)}, ${((delta/firstVo2.value)*100).toFixed(1)}%) across ${vo2.length} monthly readings. Keep easy aerobic sessions in the mix.`, tone: delta >= 0 ? "ready" : "caution"});
  }
  if (recent.length || previous.length) notes.push({title: "Your recent rhythm", text: `${recent.length} sessions in the last 28 days versus ${previous.length} in the previous 28. ${recent.length > previous.length ? "Your frequency is rising; leave room for easier days between demanding sessions." : "Focus on a repeatable training rhythm rather than trying to catch up."}`, tone: "neutral"});
  if (freshBattery) notes.push({title: "Recharge signal", text: `Your latest daily Body Battery high was ${freshBattery.values["Daily High"] ?? "—"}/100 and low was ${freshBattery.values["Daily Low"] ?? "—"}/100 on ${freshBattery.date}. ${ (freshBattery.values["Daily High"] ?? 100) < 50 ? "Consider a lighter session if you also feel tired." : "Use how you feel today alongside this recorded recharge range."}`, tone: (freshBattery.values["Daily High"] ?? 100) < 50 ? "caution" : "neutral"});
  if (baselineRhr !== null && latestRhr) notes.push({title: "Your heart-rate baseline", text: `Latest weekly resting heart rate: ${latestRhr.value} bpm (${latestRhr.date}); prior eight available readings average ${baselineRhr.toFixed(1)} bpm. ${latestRhr.value > baselineRhr + 5 ? "This is above your recent baseline; check sleep, stress and how you feel before a hard session." : "Track this over time alongside your training and recovery."}`, tone: latestRhr.value > baselineRhr + 5 ? "caution" : "neutral"});
  const completeIntensity = intensity.filter(w => new Date(w.date).getTime() + 7*864e5 <= end);
  const goals = completeIntensity.filter(w => {const actual = w.values["Actual"]; const target = w.values["Value"]; return actual !== null && actual !== undefined && target !== null && target !== undefined && actual >= target;}).length;
  if (completeIntensity.length) notes.push({title: "Intensity-minute consistency", text: `You met the exported weekly target in ${goals} of ${completeIntensity.length} completed recorded weeks. Garmin intensity minutes can weight vigorous effort; they are not workout duration.`, tone: "neutral"});
  const counts = Object.entries(activities.reduce<Record<string, number>>((a,e) => {a[e.type] = (a[e.type] ?? 0)+1; return a;},{})).sort((a,b) => b[1]-a[1]);
  const monthly = Array.from({length: 12}, (_,i) => {const d = new Date(`${today}T12:00:00`); d.setDate(1); d.setMonth(d.getMonth()-11+i); const month = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; return {date: month, sessions: activities.filter(e => e.date.startsWith(month)).length};});
  return {activities, data, vo2, rhr, stress, steps, battery, intensity, freshBattery, latestVo2, latestRhr, latestStress, notes, counts, monthly, recent, weeklySteps: avg(steps.slice(-4).map(r => r.value))};
}