import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
export const fetchFitnessDashboard = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const [daily,activities]=await Promise.all([context.supabase.from('garmin_daily').select('*').order('date',{ascending:false}).limit(100),context.supabase.from('garmin_activities').select('activity_id,name,type,start_time_local,duration_seconds,distance_meters,avg_hr,max_hr,calories,aerobic_te,anaerobic_te,training_load,avg_pace_or_speed,elevation_gain').order('start_time_local',{ascending:false}).limit(10000)]);
 if(daily.error)throw new Error('Daily readings could not be loaded. Please try again.');if(activities.error)throw new Error('Workouts could not be loaded. Please try again.');
 return {daily:daily.data.map(d=>({...d,raw:null})),activities:activities.data.map(a=>({...a,raw:null})),userId:context.userId};
});
