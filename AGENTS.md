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
