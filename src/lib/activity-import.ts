import Papa from "papaparse";

export const MUSCLES = ["Chest", "Back", "Shoulders", "Arms", "Core", "Quads", "Hamstrings", "Glutes", "Calves"] as const;
export type Muscle = (typeof MUSCLES)[number];
export type Entry = {
  id: string;
  date: string;
  type: string;
  title?: string | null;
  muscles: Muscle[];
  intensity: number | null;
  sleep: number | null;
  soreness: number | null;
  duration?: string | null;
  avg_hr?: number | null;
  max_hr?: number | null;
  calories?: number | null;
  distance?: number | null;
  source_key?: string | null;
};

const numeric = (value: string | undefined) => {
  if (!value || value === "--") return null;
  const n = Number(value.replaceAll(",", ""));
  return Number.isFinite(n) ? n : null;
};

export function parseActivities(text: string) {
  const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: "greedy", transformHeader: h => h.trim().replace(/^\uFEFF/, "") });
  if (result.errors.length) throw new Error("This CSV could not be read. Check its columns and try again.");
  if (!result.meta.fields?.includes("Activity Type") || !result.meta.fields.includes("Date")) throw new Error("Choose an activity CSV with Activity Type and Date columns.");
  const seen = new Set<string>();
  return result.data.map(row => {
    if (!row["Activity Type"] || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(row.Date) || !Number.isFinite(new Date(row.Date.replace(" ", "T")).getTime())) throw new Error("An activity is missing a valid date or workout type.");
    const source_key = JSON.stringify([row.Date, row["Activity Type"], row.Title]);
    if (seen.has(source_key)) return null;
    seen.add(source_key);
    return {
      source_key, date: row.Date.replace(" ", "T"), type: row["Activity Type"], title: row.Title,
      muscles: [] as Muscle[], intensity: null, sleep: null, soreness: null,
      duration: row.Time === "--" ? null : row.Time,
      avg_hr: numeric(row["Avg HR"]), max_hr: numeric(row["Max HR"]),
      calories: numeric(row.Calories), distance: numeric(row.Distance), source_data: row,
    };
  }).filter(row => row !== null);
}

export function recoveryFor(muscle: Muscle, entries: Entry[], now: number) {
  let worst = 100;
  for (const e of entries) {
    if (!e.muscles.includes(muscle) || e.intensity === null || e.sleep === null || e.soreness === null) continue;
    const hoursSince = (now - new Date(e.date).getTime()) / 36e5;
    const sleepFactor = e.sleep >= 7 ? 1 : 1 + (7 - e.sleep) * 0.1;
    const needed = (24 + e.intensity * 6 + e.soreness * 2) * sleepFactor;
    worst = Math.min(worst, Math.max(0, Math.min(100, (hoursSince / needed) * 100)));
  }
  return Math.round(worst);
}

export const hasRecoveryDetails = (e: Entry) => e.muscles.length > 0 && e.intensity !== null && e.sleep !== null && e.soreness !== null;