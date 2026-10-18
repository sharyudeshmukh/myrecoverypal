import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { AppNav } from '@/components/app-nav';
export const Route = createFileRoute('/_authenticated')({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: '/auth' });
    return { userId: data.user.id };
  },
  component: Shell,
});
function Shell() {
  return (
    <div className="min-h-screen pb-20">
      <Outlet />
      <AppNav />
    </div>
  );
}
