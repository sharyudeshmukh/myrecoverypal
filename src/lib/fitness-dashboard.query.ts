import { queryOptions } from '@tanstack/react-query';
import { fetchFitnessDashboard } from './fitness-dashboard.functions';
export const dashboardQuery = (userId:string) => queryOptions({queryKey:['fitness-dashboard',userId],queryFn:()=>fetchFitnessDashboard(),staleTime:60000});
