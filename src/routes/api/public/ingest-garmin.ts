import { createFileRoute } from "@tanstack/react-router";
import { handleGarminIngest } from "@/lib/garmin-ingest";
import type { Json, TablesInsert } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/public/ingest-garmin")({
  server: {
    handlers: {
      POST: ({ request }) => handleGarminIngest(request, process.env["INGEST_TOKEN"], async payload => {
        // Caller has been verified before loading the privileged client.
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const days = [...new Map(payload.days.map(day => [day.date, day])).values()];
        const activities = [...new Map(payload.activities.map(activity => [String(activity.activity_id), activity])).values()];
        const dailyRows = days.map(row => ({ ...row, raw: row.raw ?? row })) as TablesInsert<"garmin_daily">[];
        // Preserve large bigint IDs as decimal strings over the wire, never round them.
        const activityRows = activities.map(row => ({ ...row, raw: (row.raw ?? row) as Json })) as unknown as TablesInsert<"garmin_activities">[];
        if (dailyRows.length) {
          const { error } = await supabaseAdmin.from("garmin_daily").upsert(dailyRows, { onConflict: "date" });
          if (error) throw error;
        }
        if (activityRows.length) {
          const { error } = await supabaseAdmin.from("garmin_activities").upsert(activityRows, { onConflict: "activity_id" });
          if (error) throw error;
        }
        return { days: days.length, activities: activities.length };
      }),
    },
  },
});