import type { Tables } from '@/integrations/supabase/types';
export type Daily = Tables<'garmin_daily'>;
export type Workout = Tables<'garmin_activities'>;
export const STEP_GOAL = 8000;
export const OVERNIGHT = 'No overnight data — wear your watch to bed';
export const TYPES = ['strength_training', 'treadmill_running', 'indoor_cardio', 'running'] as const;
export type WorkoutType = typeof TYPES[number] | 'other';
export const LABELS: Record<WorkoutType, string> = {strength_training:'Strength',treadmill_running:'Treadmill',indoor_cardio:'Indoor cardio',running:'Running',other:'Other'};
export function shiftDate(date: string, days: number) { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate()+days); return d.toISOString().slice(0,10); }
export function weekStart(date: string) {const d = new Date(`${date.slice(0,10)}T12:00:00Z`); return shiftDate(date.slice(0,10), -((d.getUTCDay()+6)%7));}
export function average(values: (number|null)[]) { const present = values.filter((v): v is number => v !== null && Number.isFinite(v)); return present.length ? present.reduce((a,b)=>a+b,0)/present.length : null; }
export function normalizeDay(day: Daily): Daily { return {...day,stress_avg: day.stress_avg !== null && day.stress_avg < 0 ? null : day.stress_avg,resting_hr: day.sleep_seconds === null ? null : day.resting_hr}; }
export function suggestion(day?: Daily): 'Push'|'Steady'|'Recover' { if ((day?.body_battery_high !== null && day?.body_battery_high !== undefined && day.body_battery_high < 40) || (day?.sleep_seconds !== null && day?.sleep_seconds !== undefined && day.sleep_seconds < 21600)) return 'Recover'; if ((day?.body_battery_wake ?? -1) >=75 && (day?.sleep_seconds ?? -1)>=25200) return 'Push'; return 'Steady'; }
export function workoutType(type: string|null): WorkoutType {const t=(type??'').toLowerCase().replace(/[ -]/g,'_'); if(t==='cardio') return 'indoor_cardio'; return TYPES.find(x=>x===t) ?? 'other';}
export function weeklyWorkouts(activities: Workout[], today: string, days: number) {
 const first=weekStart(shiftDate(today,1-days)), last=weekStart(today);
 const rows: {date:string;count:number;minutes:number;runningKm:number|null;strength_training:number;treadmill_running:number;indoor_cardio:number;running:number;other:number;strength_trainingMinutes:number;treadmill_runningMinutes:number;indoor_cardioMinutes:number;runningMinutes:number;otherMinutes:number}[]=[];
 for(let date=first;date<=last;date=shiftDate(date,7)) rows.push({date,count:0,minutes:0,runningKm:null,strength_training:0,treadmill_running:0,indoor_cardio:0,running:0,other:0,strength_trainingMinutes:0,treadmill_runningMinutes:0,indoor_cardioMinutes:0,runningMinutes:0,otherMinutes:0});
 activities.forEach(a=>{if(!a.start_time_local||a.start_time_local.slice(0,10)>today)return;const row=rows.find(r=>r.date===weekStart(a.start_time_local??today)); if(!row)return; const type=workoutType(a.type);row.count++;row[type]++;const minutes=(a.duration_seconds??0)/60;row.minutes+=minutes;row[`${type}Minutes`]+=minutes;if((type==='running'||type==='treadmill_running')&&a.distance_meters!==null)row.runningKm=(row.runningKm??0)+a.distance_meters/1000;});
 return rows;
}
export function consistencyStreak(activities: Workout[],today:string) {const counts=new Map<string,number>();activities.forEach(a=>{if(a.start_time_local&&a.start_time_local.slice(0,10)<=today){const week=weekStart(a.start_time_local);counts.set(week,(counts.get(week)??0)+1);}});let week=weekStart(today);if((counts.get(week)??0)<3)week=shiftDate(week,-7);let streak=0;while((counts.get(week)??0)>=3){streak++;week=shiftDate(week,-7);}return streak;}
export function buildDashboard(raw: Daily[],activities: Workout[],today:string,days:number) {
 const daily=raw.map(normalizeDay).filter(d=>d.date<=today).sort((a,b)=>a.date.localeCompare(b.date));
 const current=daily.find(d=>d.date===today); const first=shiftDate(today,1-days); const chart=Array.from({length:days},(_,i)=>{const date=shiftDate(first,i),d=daily.find(x=>x.date===date);return {date,batteryHigh:d?.body_battery_high??null,batteryLow:d?.body_battery_low??null,batteryBand:d?.body_battery_high!==null&&d?.body_battery_high!==undefined&&d.body_battery_low!==null?[d.body_battery_low,d.body_battery_high]:null,sleep:d?.sleep_seconds===null||d?.sleep_seconds===undefined?null:d.sleep_seconds/3600,stress:d?.stress_avg??null,steps:d?.steps??null};});
 const recent=daily.filter(d=>d.date>=shiftDate(today,-6)), previous=daily.filter(d=>d.date>=shiftDate(today,-13)&&d.date<shiftDate(today,-6));
 const count=(from:string,to:string)=>activities.filter(a=>a.start_time_local&&a.start_time_local.slice(0,10)>=from&&a.start_time_local.slice(0,10)<=to).length;
 const a=count(shiftDate(today,-6),today),b=count(shiftDate(today,-13),shiftDate(today,-7));
 const observations=[{title:'Training rhythm',text:`${a} workouts in the last 7 days, ${a===b?'unchanged from':a>b?'up from':'down from'} ${b} in the previous 7 days.`}];
 for(const [key,title,unit] of [['body_battery_high','Daily recharge','/100'],['stress_avg','Stress',''],['steps','Daily movement',' steps']] as const){const now=average(recent.map(d=>d[key])),before=average(previous.map(d=>d[key]));observations.push({title,text:now===null||before===null?'Not enough recorded readings to compare these two weeks.':`Average ${key==='body_battery_high'?'Body Battery high':key==='stress_avg'?'stress':'steps'} ${now===before?'held at':now>before?'rose to':'fell to'} ${Math.round(now).toLocaleString()}${unit}, versus ${Math.round(before).toLocaleString()}${unit} the previous week (${recent.filter(d=>d[key]!==null).length} vs. ${previous.filter(d=>d[key]!==null).length} days recorded).`});}
 const choice=suggestion(current);const recommendation=!current?'No reading for today yet. Keep your session comfortable and reassess when your watch syncs.':choice==='Recover'?'Choose rest, an easy walk, or gentle mobility today; prioritize your next night of sleep.':choice==='Push'?'Your recorded sleep and wake battery support a demanding session today, if you feel well and soreness is low.':'Keep today’s session moderate and adjust to how you feel.';
 return {current,chart,observations,recommendation,choice,nights:chart.filter(d=>d.sleep!==null).length,rhrAverage:average(daily.filter(d=>d.date>=shiftDate(today,-6)).map(d=>d.resting_hr)),weeks:weeklyWorkouts(activities,today,days),streak:consistencyStreak(activities,today)};
}
