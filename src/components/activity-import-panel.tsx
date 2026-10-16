import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { parseGarmin, mergeGarmin, type GarminImport } from "@/lib/garmin";
import { FitnessJourney } from "@/components/fitness-journey";
import { Button } from "@/components/ui/button";
import { ActivitySignIn } from "@/components/activity-sign-in";
import { Upload } from "lucide-react";

export function ActivityImportPanel({ userId, refresh }: {userId: string | null; refresh: () => Promise<void>}) {
  const [selection, setSelection] = useState<GarminImport>({activities: [], wellness: []});
  const rows = selection.activities;
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return <section className="mb-8 space-y-4 border-y py-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Import Garmin data</h2><label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-accent"><Upload className="size-4" />Choose CSV files<input aria-label="Choose activity CSV" type="file" multiple accept=".csv,text/csv" className="sr-only" disabled={busy} onChange={async e => {
      const files = Array.from(e.target.files ?? []); if (!files.length) return;
      setMessage("");
      try { const parsed = await Promise.all(files.map(async file => parseGarmin(await file.text()))); setSelection(previous => mergeGarmin([previous, ...parsed])); } catch (error) {setMessage(error instanceof Error ? error.message : "Unable to read these files.");}
      e.target.value = "";
    }} /></label></div>
    {(rows.length > 0 || selection.wellness.length > 0) && <><p className="text-sm text-muted-foreground">{rows.length} activities · {selection.wellness.length} wellness readings · {new Set(selection.wellness.map(w => w.metric)).size} wellness metrics</p><FitnessJourney entries={rows.map(row => ({...row,id:row.source_key}))} wellness={selection.wellness} preview />{userId && <Button disabled={busy} onClick={async () => {
      setBusy(true); setMessage("");
      try {
        let count = 0;
        if (rows.length) {
          const {data, error} = await supabase.from("recovery_activities").upsert(rows.map(row => ({...row, user_id: userId})), {onConflict: "user_id,source_key", ignoreDuplicates: true}).select("id");
          if (error) throw error;
          count = data.length;
        }
        if (selection.wellness.length) {
          const {error} = await supabase.from("garmin_wellness").upsert(selection.wellness.map(row => ({...row,user_id:userId})), {onConflict:"user_id,metric,date"});
          if (error) throw error;
        }
        await refresh(); setMessage(`Saved ${count} new activities and ${selection.wellness.length} wellness readings. Duplicate activities skipped.`); setSelection({activities:[],wellness:[]});
      } catch (error) {setMessage(error instanceof Error ? error.message : "Import failed. Try again.");}
      finally {setBusy(false);}
    }}><Upload />{busy ? "Importing…" : "Save Garmin data"}</Button>}<Button variant="ghost" disabled={busy} onClick={() => setSelection({activities:[],wellness:[]})}>Clear selection</Button></>}
    {!userId && <div className="max-w-sm"><ActivitySignIn /></div>}
    {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
  </section>;
}