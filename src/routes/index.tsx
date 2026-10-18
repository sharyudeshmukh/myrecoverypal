import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { ActivitySignIn } from '@/components/activity-sign-in';
import { supabase } from '@/integrations/supabase/client';
import { Activity, ShieldCheck } from 'lucide-react';
export const Route=createFileRoute('/')({head:()=>({meta:[{title:'NextRep — Your fitness, in focus'},{name:'description',content:'Your private Garmin recovery, daily trends, and workout insights.'},{property:'og:title',content:'NextRep — Your fitness, in focus'},{property:'og:description',content:'Your private Garmin fitness and recovery dashboard.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),component:SignInPage});
export function SignInPage(){const navigate=useNavigate();useEffect(()=>{void supabase.auth.getUser().then(({data})=>{if(data.user)void navigate({to:'/today'});});},[navigate]);return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6 py-12"><div><Activity className="mb-5 size-9 text-primary"/><h1 className="mt-2 text-4xl font-bold">NextRep</h1><p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="size-4"/>Lose weight, build muscle — one clear next rep at a time.</p></div><ActivitySignIn/></main>;}
