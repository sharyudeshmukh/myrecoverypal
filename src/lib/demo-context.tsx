import { createContext, useContext, type ReactNode } from 'react';
import type { DemoData } from './demo-data';

export const DEMO_TOAST = 'This is a demo — sign in to track your own data';

const DemoModeContext = createContext(false);

export function DemoModeProvider({ children }: { children: ReactNode }) {
  return <DemoModeContext.Provider value={true}>{children}</DemoModeContext.Provider>;
}

export function useDemoMode(): boolean {
  return useContext(DemoModeContext);
}

const DemoDataContext = createContext<DemoData | null>(null);

export function DemoDataProvider({ value, children }: { value: DemoData; children: ReactNode }) {
  return <DemoDataContext.Provider value={value}>{children}</DemoDataContext.Provider>;
}

export function useDemoData(): DemoData {
  const data = useContext(DemoDataContext);
  if (!data) throw new Error('Demo data is only available in demo mode.');
  return data;
}
