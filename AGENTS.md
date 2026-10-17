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
