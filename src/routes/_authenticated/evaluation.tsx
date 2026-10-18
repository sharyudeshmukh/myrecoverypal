import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useSuspenseQuery, useQueryErrorResetBoundary } from '@tanstack/react-query';
import { evaluationQuery } from '@/lib/evaluation.query';
import { EvaluationPage } from '@/components/evaluation-page';
import { Button } from '@/components/ui/button';
export const Route = createFileRoute('/_authenticated/evaluation')({
  loader: ({context}) => context.queryClient.ensureQueryData(evaluationQuery(context.userId)),
  head: () => ({meta:[{title:'Evaluation — NextRep'},{name:'description',content:'Private frozen recommendation adherence and observational recovery outcomes with uncertainty intervals.'},{property:'og:title',content:'Evaluation — NextRep'},{property:'og:description',content:'Honest evidence about your NextRep recommendations, with live and replay cohorts kept explicit.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
  pendingComponent:()=> <main className="mx-auto max-w-6xl p-8 text-muted-foreground">Freezing recommendations and preparing your evaluation…</main>,
  errorComponent: EvaluationError,
  component: Evaluation,
});
function Evaluation() {
  const {userId} = Route.useRouteContext();
  const {data} = useSuspenseQuery(evaluationQuery(userId));
  return <EvaluationPage {...data}/>;
}
function EvaluationError() {
  const router = useRouter(), boundary = useQueryErrorResetBoundary();
  return <main className="mx-auto max-w-lg space-y-4 p-8"><h1 className="text-2xl font-bold">Evaluation couldn’t be loaded</h1><p className="text-muted-foreground">Your recommendation history remains private. Try reconnecting.</p><Button onClick={()=>{boundary.reset();void router.invalidate();}}>Try again</Button></main>;
}