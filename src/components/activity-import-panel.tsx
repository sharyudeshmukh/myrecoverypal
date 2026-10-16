import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { parseActivities } from "@/lib/activity-import";
import { Button } from "@/components/ui/button";
import { ActivitySignIn } from "@/components/activity-sign-in";
import { Upload } from "lucide-react";

export function ActivityImportPanel({ userId, refresh }: {userId: string | null; refresh: () => Promise<void>}) {
  const [rows, setRows] = useState<ReturnType<typeof parseActivities>>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return <section className="mb-8 space-y-4 border-y py-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Import activities</h2><label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-accent"><Upload className="size-4" />Choose CSV<input aria-label="Choose activity CSV" type="file" accept=".csv,text/csv" className="sr-only" disabled={busy} onChange={async e => {
      const file = e.target.files?.[0]; if (!file) return;
      setMessage(""); setRows([]);
      try { setRows(parseActivities(await file.text())); } catch (error) {setMessage(error instanceof Error ? error.message : "Unable to read this file.");}
      e.target.value = "";
    }} /></label></div>
    {rows.length > 0 && <><p className="text-sm text-muted-foreground">{rows.length} activities · {rows.map(r => r.date.slice(0,10)).sort()[0]} to {rows.map(r => r.date.slice(0,10)).sort().at(-1)}</p><p className="text-sm text-caution">Muscles, intensity, sleep and soreness are missing. Recovery details needed.</p><ul className="space-y-2">{rows.slice(0,3).map(row => <li key={row.source_key} className="flex flex-wrap justify-between gap-2 text-sm"><span>{row.title || row.type} · {row.date.slice(0,10)}</span><span className="text-muted-foreground">{row.duration} · {row.avg_hr ?? "—"} bpm</span></li>)}</ul>{userId && <Button disabled={busy} onClick={async () => {
      setBusy(true); setMessage("");
      try {
        const {data, error} = await supabase.from("recovery_activities").upsert(rows.map(row => ({...row, user_id: userId})), {onConflict: "user_id,source_key", ignoreDuplicates: true}).select("id");
        if (error) throw error;
        await refresh(); setMessage(`Imported ${data.length} activities. ${rows.length - data.length} duplicates skipped.`); setRows([]);
      } catch (error) {setMessage(error instanceof Error ? error.message : "Import failed. Try again.");}
      finally {setBusy(false);}
    }}><Upload />{busy ? "Importing…" : `Import ${rows.length} activities`}</Button>}</>}
    {!userId && <div className="max-w-sm"><ActivitySignIn /></div>}
    {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
  </section>;
}