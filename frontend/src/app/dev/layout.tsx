import { notFound } from 'next/navigation';
import { DEV_TOOLS_ENABLED } from '@/lib/devTools';

export const metadata = {
  robots: { index: false, follow: false },
};

export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (!DEV_TOOLS_ENABLED) notFound();
  return children;
}
