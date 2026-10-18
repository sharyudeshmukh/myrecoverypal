import { createFileRoute } from '@tanstack/react-router';
import { SignInPage } from './index';
export const Route=createFileRoute('/auth')({head:()=>({meta:[{title:'Sign in — NextRep'},{name:'description',content:'Sign in to your private Garmin fitness dashboard.'},{property:'og:title',content:'Sign in — NextRep'},{property:'og:description',content:'Access your private fitness and recovery readings.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),component:SignInPage});
