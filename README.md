# NextRep

Lose weight, build muscle — one clear next rep at a time.

A goal-driven fitness app that turns a year of Garmin data into plain-English guidance: what to train tomorrow, how recovered each muscle is, and what your trends actually mean.

<img src="docs/hero.gif" alt="NextRep: Today screen with next-workout recommendation, automatic muscle Recovery map, and a workout detail page with heart-rate zones and strength log" width="720" />

## Highlights

- **Today** — a rule-based "next workout" engine (strength, cardio, or recovery day) with reasons, HR zones, and a low-energy alternative, plus today's metric tiles with 7-day sparklines.
- **Workouts** — every Garmin session with heart-rate zones, splits, comparison to the previous session, and a strength log with progressive-overload callouts.
- **Recovery** — fully automatic muscle-recovery estimates computed from Garmin exercise data and cardio load, with exponential decay adjusted by Body Battery.
- **Trends** — Body Battery, sleep, stress, steps, and weekly training volume over 30 or 90 days.
- **Goals** — weight trend toward your target, goal settings, and an insights feed that compares your last 7 days to the previous 7.

## Try it

- Live demo (sample data, no sign-up): `/demo`
- Sign in to sync your own Garmin data through a private ingestion endpoint.

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
- Lovable Cloud

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
