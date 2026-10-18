import { queryOptions } from '@tanstack/react-query';
import { fetchFitnessDashboard } from './fitness-dashboard.functions';
import { fetchWorkoutDetail } from './goals.functions';
export const dashboardQuery = (userId: string) => queryOptions({ queryKey: ['fitness-dashboard', userId], queryFn: () => fetchFitnessDashboard(), staleTime: 60000, refetchInterval: 60000 });
export const workoutDetailQuery = (activityId: number) => queryOptions({ queryKey: ['workout-detail', activityId], queryFn: () => fetchWorkoutDetail({ data: { activityId } }), staleTime: 60000 });
