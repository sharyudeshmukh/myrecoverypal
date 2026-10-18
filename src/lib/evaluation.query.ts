import { queryOptions } from '@tanstack/react-query';
import { fetchEvaluation } from './evaluation.functions';
export const evaluationQuery = (userId: string) => queryOptions({ queryKey: ['evaluation', userId], queryFn: () => fetchEvaluation(), staleTime: 60000, refetchInterval: 60000 });