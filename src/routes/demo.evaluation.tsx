import { createFileRoute } from '@tanstack/react-router';
import { useDemoData } from '@/lib/demo-context';
import { EvaluationPage } from '@/components/evaluation-page';
export const Route = createFileRoute('/demo/evaluation')({
  head:()=>({meta:[{title:'Evaluation (demo) — NextRep'},{name:'description',content:'Synthetic NextRep adherence and outcome comparisons with bootstrap uncertainty and observational caveats.'},{property:'og:title',content:'Evaluation (demo) — NextRep'},{property:'og:description',content:'Explore an honest product-data-science evaluation using synthetic data only.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
  component:()=>{const d=useDemoData();return <EvaluationPage logs={d.recommendationLogs} daily={d.daily} activities={d.activities} goals={d.goals} today={d.daily.at(-1)?.date ?? ''} demo/>;},
});