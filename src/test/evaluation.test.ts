import { describe, it, expect } from 'vitest';
import { bootstrapDifference, classifyAdherence, evaluateLogs, freezeRecommendation, replayHistory, weekProgress, type RecommendationLog } from '@/lib/evaluation';
import { generateDemoData } from '@/lib/demo-data';
import type { Workout, Daily } from '@/lib/fitness-dashboard';

const today = '2026-10-18';
const demo = generateDemoData(today);
const rec = (type: RecommendationLog['rec_type'] = 'strength'): RecommendationLog => ({ ...freezeRecommendation(demo.daily,demo.activities,demo.goals,demo.strengthSets,'2026-10-16','owner','replay'), rec_type:type, duration_min:40 });
const activity = (type = 'strength_training', minutes = 40, raw: Workout['raw'] = null): Workout => ({...demo.activities[0] as Workout,activity_id:123,type,duration_seconds:minutes*60,start_time_local:'2026-10-16T10:00:00',raw});
describe('automatic adherence',()=>{
  it('matching strength at exactly 60% is followed',()=>expect(classifyAdherence(rec(),[activity('strength_training',24)]).adherence).toBe('followed'));
  it('matching strength below 60% is partial',()=>expect(classifyAdherence(rec(),[activity('strength_training',23.99)]).adherence).toBe('partial'));
  it('sums matching sessions on the recommended date only',()=>expect(classifyAdherence(rec(),[activity('strength_training',12),{...activity('strength_training',12),activity_id:124}]).adherence).toBe('followed'));
  it('different workout is swapped',()=>expect(classifyAdherence(rec(),[activity('running')]).adherence).toBe('swapped'));
  it('no strength/cardio activity is skipped',()=>expect(classifyAdherence(rec('cardio'),[]).adherence).toBe('skipped'));
  it.each(['running','treadmill_running','indoor_cardio'])('accepts %s for cardio',type=>expect(classifyAdherence(rec('cardio'),[activity(type)]).adherence).toBe('followed'));
  it('rest day follows recovery',()=>expect(classifyAdherence(rec('recovery'),[]).adherence).toBe('followed'));
  it('strength violates recovery even when short',()=>expect(classifyAdherence(rec('recovery'),[activity('strength_training',1)]).adherence).toBe('swapped'));
  it('exactly 10 minutes in zones 4–5 violates recovery',()=>expect(classifyAdherence(rec('recovery'),[activity('running',30,{hrTimeInZone_4:300,hrTimeInZone_5:300})]).adherence).toBe('swapped'));
  it('less than 10 hard minutes follows recovery',()=>expect(classifyAdherence(rec('recovery'),[activity('running',30,{hrTimeInZone_4:299,hrTimeInZone_5:300})]).adherence).toBe('followed'));
  it('missing recovery zone evidence is uncertain rather than treated as confirmed',()=>expect(classifyAdherence(rec('recovery'),[activity('running')]).uncertain).toBe(true));
});
describe('missing-aware outcomes',()=>{
  const next: Daily = {...demo.daily[0] as Daily,date:'2026-10-17',body_battery_wake:null,body_battery_high:77,sleep_seconds:null,resting_hr:60,stress_avg:-1};
  it('next-morning battery falls back to high',()=>expect(evaluateLogs([rec()],[next],[],today)[0]?.battery).toBe(77));
  it('resting HR without sleep is missing',()=>expect(evaluateLogs([rec()],[next],[],today)[0]?.restingHr).toBeNull());
  it('negative next-day stress is missing',()=>expect(evaluateLogs([rec()],[next],[],today)[0]?.stress).toBeNull());
  it('current date is pending, never counted as skipped',()=>expect(evaluateLogs([{...rec(),for_date:today}],[],[],today)[0]?.adherence).toBeNull());
  it('ongoing week target outcomes stay pending',()=>expect(evaluateLogs([rec()],[],[],today)[0]?.strengthMet).toBeNull());
  it('weekly targets require concrete strength/cardio thresholds',()=>{
    const a=[activity(),{...activity(),activity_id:124},{...activity(),activity_id:125},activity('running',150)];
    expect(weekProgress(a,'2026-10-12',3,150)).toEqual({strengthMet:true,cardioMet:true});
    expect(weekProgress(a,'2026-10-12',4,151)).toEqual({strengthMet:false,cardioMet:false});
  });
});
describe('bootstrap uncertainty',()=>{
  it('withholds all means and differences below 8 in either group',()=>{
    const c=bootstrapDifference(Array(7).fill(70),Array(8).fill(65));
    expect(c.missing).toBe(1);expect(c.estimate).toBeNull();expect(c.followedMean).toBeNull();
  });
  it('at n=8 each reports a known five-point difference and 90% interval',()=>{
    const c=bootstrapDifference(Array(8).fill(70),Array(8).fill(65));
    expect(c.estimate).toBe(5);expect(c.low).toBe(5);expect(c.high).toBe(5);
  });
  it('resampling is deterministic and ignores missing nonfinite values',()=>{
    const a=[60,62,65,68,70,73,80,90],b=[55,60,61,63,68,75,81,88];
    expect(bootstrapDifference(a,b)).toEqual(bootstrapDifference([...a,NaN],b));
  });
});
describe('replay has no future or target-day leakage',()=>{
  it('only prior dates and sessions enter frozen replay inputs',()=>{
    const r=rec();const inputs=r.inputs as {daily:{date:string}[];activities:Workout[]};
    expect(inputs.daily.every(d=>d.date<r.for_date)).toBe(true);
    expect(inputs.activities.every(a=>(a.start_time_local ?? '').slice(0,10)<r.for_date)).toBe(true);
  });
  it('future and same-day changes cannot alter replay advice',()=>{
    const date='2026-10-16';
    const a=freezeRecommendation(demo.daily,demo.activities,demo.goals,demo.strengthSets,date,'owner','replay','fixed');
    const b=freezeRecommendation(demo.daily.map(d=>d.date>=date?{...d,body_battery_high:0,raw:null}:d),[...demo.activities,activity()],demo.goals,demo.strengthSets,date,'owner','replay','fixed');
    expect(a).toEqual(b);
  });
  it('one replay row per past Garmin date, source always replay',()=>{
    const logs=replayHistory(demo.daily,demo.activities,demo.goals,demo.strengthSets,'owner',today);
    expect(logs).toHaveLength(89);expect(logs.every(r=>r.source==='replay'&&r.for_date<today)).toBe(true);
  });
});
describe('isolated synthetic evaluation',()=>{
  it('90 deterministic rows with roughly 70% followed and usable cohorts',()=>{
    expect(demo.recommendationLogs).toHaveLength(90);
    expect(demo.recommendationLogs).toEqual(generateDemoData(today).recommendationLogs);
    const rows=evaluateLogs(demo.recommendationLogs,demo.daily,demo.activities,today);
    const completed=rows.filter(r=>r.adherence!==null);
    const rate=completed.filter(r=>r.adherence==='followed').length/completed.length;
    expect(rate).toBeGreaterThan(.65);expect(rate).toBeLessThan(.75);
    const live=completed.filter(r=>r.source==='live'&&!r.uncertain);
    const c=bootstrapDifference(live.filter(r=>r.adherence==='followed').map(r=>r.battery).filter((v):v is number=>v!==null),live.filter(r=>r.adherence!=='followed').map(r=>r.battery).filter((v):v is number=>v!==null));
    expect(c.missing).toBe(0);expect(c.estimate).toBeGreaterThan(0);expect(c.low).toBeLessThan(0);expect(c.high).toBeGreaterThan(0);
  });
});