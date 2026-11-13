import { Suspense } from 'react';
import { SpeedTestCard } from '@/components/SpeedTestCard';

/** Test day. The card lives in the browser, so this is a client screen.
 *  Suspense for the step in the URL (useSearchParams). */
export default function SpeedTestPage() {
  return <Suspense fallback={null}><SpeedTestCard /></Suspense>;
}
