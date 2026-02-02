"use client";
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}
interface InternalState extends ConfirmOptions {
  open: boolean;
  resolve?: (value: boolean) => void;
}
interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within <ConfirmProvider>');
  return ctx;
}

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<InternalState>({ open: false });
  const activePromise = useRef<((v: boolean)=>void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      activePromise.current = resolve;
      setState({ open: true, ...options });
    });
  }, []);

  const close = (result: boolean) => {
    if (activePromise.current) activePromise.current(result);
    activePromise.current = null;
    setState({ open: false });
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fadeInUp" onClick={() => close(false)} />
          <div className="relative w-full max-w-sm mx-auto rounded-lg bg-white shadow-lg border border-black/10 p-5 animate-slideIn">
            {state.title && <h3 className="text-lg font-semibold text-black mb-2">{state.title}</h3>}
            {state.description && <p className="text-sm text-black/70 whitespace-pre-line mb-4">{state.description}</p>}
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => close(false)}
                className="px-3 py-1.5 rounded border text-sm text-black hover:bg-black/5"
              >{state.cancelText || 'Cancel'}</button>
              <button
                onClick={() => close(true)}
                className={`px-3 py-1.5 rounded text-sm text-white shadow ${state.variant === 'destructive' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
              >{state.confirmText || 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};
