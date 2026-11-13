'use client';
import { createContext, Suspense, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * The trainer area's one way of saying "done": a short line at the bottom
 * that goes by itself. Saves, sends and changes all use it, rather than a
 * banner here, an eyebrow there and nothing elsewhere.
 *
 * A save that moves to another page says so with ?saved=1 (see withSaved in
 * content-actions); Flash turns that into the toast and tidies the address.
 */
const Ctx = createContext<(text: string) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [text, setText] = useState('');
  const [n, setN] = useState(0);
  const show = useCallback((t: string) => { setText(t); setN((x) => x + 1); }, []);
  useEffect(() => {
    if (!text) return;
    const t = setTimeout(() => setText(''), 4000);
    return () => clearTimeout(t);
  }, [text, n]);
  return (
    <Ctx.Provider value={show}>
      {children}
      <Suspense fallback={null}><Flash /></Suspense>
      {text && (
        <p key={n} role="status"
           className="sheet-in fixed inset-x-0 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-[60] mx-auto w-fit max-w-[90vw] rounded-full bg-inverse-surface px-5 py-3 text-body font-semibold text-inverse-on-surface shadow-level3 lg:bottom-8">
          {text}
        </p>
      )}
    </Ctx.Provider>
  );
}

function Flash() {
  const q = useSearchParams();
  const path = usePathname();
  const router = useRouter();
  const toast = useToast();
  const saved = q.get('saved');
  useEffect(() => {
    if (!saved) return;
    toast('Saved.');
    const rest = new URLSearchParams(q);
    rest.delete('saved');
    const s = rest.toString();
    router.replace(`${path}${s ? `?${s}` : ''}${window.location.hash}`, { scroll: false });
  }, [saved, q, path, router, toast]);
  return null;
}
