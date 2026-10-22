import { describe, it, expect } from 'vitest';
import { generateDemoData } from '@/lib/demo-data';
import { nextWorkout, progressiveOverload, goalInsights } from '@/lib/goals';
import { computeGarminRecovery } from '@/lib/garmin-recovery';
import { pacificTimestamp } from '@/lib/fitness-dashboard';

const TODAY = '2026-10-18';
const NOW = pacificTimestamp(`${TODAY}T12:00:00`);

describe('demo data', () => {
  it('is deterministic for the same anchor date', () => {
    expect(JSON.stringify(generateDemoData(TODAY))).toBe(JSON.stringify(generateDemoData(TODAY)));
  });
  it('anchors to today: 90 daily rows ending today, no future workouts', () => {
    const data = generateDemoData(TODAY);
    expect(data.daily).toHaveLength(90);
    expect(data.daily.at(-1)?.date).toBe(TODAY);
    expect(data.activities.every((a) => (a.start_time_local ?? '').slice(0, 10) < TODAY)).toBe(true);
    expect(data.activities.length).toBeGreaterThan(50);
  });
  it('watch worn every night — full sleep data on all 90 days', () => {
    const data = generateDemoData(TODAY);
    expect(data.daily.every((d) => d.sleep_seconds !== null && d.hrv_last_night_avg !== null && d.resting_hr !== null)).toBe(true);
  });
  it('tells the story: upper-body strength recommended today', () => {
    const data = generateDemoData(TODAY);
    const next = nextWorkout(data.daily, data.activities, data.goals, data.strengthSets, TODAY, NOW);
    expect(next.type).toBe('strength');
    expect(next.title).toContain('upper');
    expect(next.why.length).toBeGreaterThanOrEqual(2);
  });
  it('legs are recovering after yesterday\u2019s lower-body session; upper body is fresh', () => {
    const data = generateDemoData(TODAY);
    const recovery = computeGarminRecovery(data.activities, data.daily, NOW);
    const quads = recovery.cards.find((c) => c.muscle === 'quads');
    expect(['Recovering', 'Fatigued']).toContain(quads?.status);
    expect(recovery.freshest.every((m) => ['chest', 'back', 'shoulders', 'arms', 'core'].includes(m))).toBe(true);
    expect(recovery.hasData).toBe(true);
  });
  it('weight trends from 182 lb toward ~174 lb with a 165 target', () => {
    const data = generateDemoData(TODAY);
    expect(data.weightLog[0]?.weight).toBeGreaterThan(179);
    expect(data.weightLog[0]?.weight).toBeLessThan(185);
    const last = data.weightLog.at(-1)?.weight ?? 0;
    expect(last).toBeGreaterThan(170);
    expect(last).toBeLessThan(178);
    expect(data.goals.target_weight).toBe(165);
    expect(data.goals.units).toBe('lb');
  });
  it('progressive overload is visible on the squat', () => {
    const data = generateDemoData(TODAY);
    const notes = progressiveOverload(data.strengthSets, data.activities, TODAY);
    expect(notes.some((n) => n.includes('Squat'))).toBe(true);
  });
  it('surfaces personal-best insights', () => {
    const data = generateDemoData(TODAY);
    const { insights } = goalInsights(data.daily, data.activities, data.weightLog, data.strengthSets, data.goals, TODAY);
    const bests = insights.filter((i) => i.title.startsWith('Personal best'));
    expect(bests.length).toBeGreaterThanOrEqual(2);
    expect(bests.some((b) => b.text.includes('km'))).toBe(true);
  });
  it('every strength workout has named Garmin exercise categories', () => {
    const data = generateDemoData(TODAY);
    const strength = data.activities.filter((a) => a.type === 'strength_training');
    expect(strength.length).toBeGreaterThan(20);
    expect(strength.every((a) => Array.isArray((a.raw as { summarizedExerciseSets?: unknown[] }).summarizedExerciseSets))).toBe(true);
  });
});
