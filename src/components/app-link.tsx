import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useDemoMode } from '@/lib/demo-context';

// Internal app link that stays inside /demo when demo mode is active.
export function AppLink({ to, params, className, children, ...rest }: { to: string; params?: Record<string, string>; className?: string; children: ReactNode; 'aria-current'?: 'page' }) {
  const demo = useDemoMode();
  if (demo) {
    let href = `/demo${to}`;
    for (const [key, value] of Object.entries(params ?? {})) href = href.replace(`$${key}`, value);
    return <a href={href} className={className} {...rest}>{children}</a>;
  }
  return <Link to={to as never} params={params as never} className={className} {...rest}>{children}</Link>;
}
