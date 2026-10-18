<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Persist signed-in activity history in owner-scoped Cloud tables; keep browser-only legacy workouts separate until explicitly imported to prevent cross-account leaks.
- Parse activity CSVs in the browser with Papa Parse and retain original source values; missing recovery inputs remain nullable and excluded from recovery estimates.
- Do not bundle personal uploaded activity data in public app assets; users select the file for an authenticated import.
- Store Garmin wellness readings separately with their reported period; show evidence-based deterministic insights and never merge weekly summaries into a fabricated daily readiness score.
- External Garmin ingestion uses a token-authenticated TanStack public server route with privileged writes; single-owner SELECT policies keep date/activity-ID primary keys private to the designated account.

- Keep dashboard reads in authenticated server functions with user-keyed Query caches; the protected route layout gates private pages and sign-out clears cached readings to prevent account leakage.
- Compute daily dashboard rules and weekly summaries in the pure fitness-dashboard module so thresholds and missing-data behavior remain testable independently of charts.
- Compute goal rules (next-workout engine, HR zones, insights feed, strength volume/overload) in the pure `src/lib/goals.ts` module with tests, so thresholds stay independent of UI.
- Signed-in app pages live under `_authenticated/` with a shared bottom nav (Today `/today`, Workouts `/workouts`, Trends `/trends`, Goals `/goals`, Recovery `/workout-log`); `/` stays the public sign-in page and `/dashboard` redirects to `/trends`.
- A list page with child detail routes must be an index route (`workouts.index.tsx`) — a plain `workouts.tsx` parent without an `<Outlet />` shadows its children.
- Automatic muscle recovery is computed in the pure garmin-recovery module from recent Garmin raw activities; Recovery and Today share it so muscle suggestions agree without manual inputs.
- Dashboard reads include raw payloads only for recent recovery activities and poll the user-keyed cache every minute so incoming Garmin data appears automatically without fetching historical raw payloads.
- Demo mode is a deterministic client-side fixture behind a data-provider context that swaps in the same shapes the real queries return, so shared components render both sources through one code path; it must never read or write application tables or call the ingest route, and every write action surfaces a sign-in notice instead of persisting.


- Recommendation snapshots are immutable server-only inserts keyed by owner/date; Today renders stored advice, while adherence/outcomes remain derived to reflect late syncs.
- Evaluation math and prior-only replay live in the pure evaluation module with deterministic bootstrap tests; demo evaluation fixtures never call real queries.
- Garmin sync calls the separate token-verified evaluate-garmin endpoint after successful ingestion; the ingest endpoint stays unchanged. Run the updated sync script and publish new endpoint changes to activate unattended capture.
