'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export type ConfirmTone = 'default' | 'danger' | 'warning';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
}

interface ConfirmContextValue {
  /** Open a confirmation dialog. Resolves to `true` on confirm, `false` on cancel/dismiss. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

interface PendingDialog extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<PendingDialog | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setDialog({ ...options, resolve });
    });
  }, []);

  const close = useCallback(
    (result: boolean) => {
      if (!dialog) return;
      dialog.resolve(result);
      setDialog(null);
    },
    [dialog],
  );

  useEffect(() => {
    if (!dialog) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        close(true);
      }
    };
    document.addEventListener('keydown', handleKey);
    confirmBtnRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [dialog, close]);

  const value = useMemo<ConfirmContextValue>(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {dialog && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4 animate-[fadeIn_120ms_ease-out]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ss-confirm-title"
          aria-describedby={dialog.description ? 'ss-confirm-desc' : undefined}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close(false);
          }}
        >
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden animate-[popIn_150ms_ease-out]">
            <div className="px-7 pt-6 pb-5">
              <h2
                id="ss-confirm-title"
                className="text-xl font-semibold tracking-tight text-gray-900"
              >
                {dialog.title}
              </h2>
              {dialog.description && (
                <p
                  id="ss-confirm-desc"
                  className="mt-3 text-base leading-relaxed text-gray-600 whitespace-pre-line"
                >
                  {dialog.description}
                </p>
              )}
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 px-7 pb-6">
              <button
                type="button"
                onClick={() => close(false)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-5 py-3 text-base font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition"
              >
                {dialog.cancelLabel ?? 'Cancel'}
              </button>
              <button
                ref={confirmBtnRef}
                type="button"
                onClick={() => close(true)}
                className={`inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-3 text-base font-semibold text-white shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 transition ${
                  dialog.tone === 'danger'
                    ? 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500'
                    : dialog.tone === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500'
                    : 'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500'
                }`}
              >
                {dialog.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

/**
 * Hook to open a confirmation modal.
 *
 * Example:
 *   const confirm = useConfirm();
 *   const ok = await confirm({
 *     title: 'Delete this entry?',
 *     description: 'This action cannot be undone.',
 *     tone: 'danger',
 *     confirmLabel: 'Delete',
 *   });
 *   if (!ok) return;
 */
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used inside <ConfirmProvider>.');
  }
  return ctx.confirm;
}
