"use client";
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';
interface ToastItem { id: string; message: string; variant: ToastVariant; timeout?: number; }
interface ToastContextValue {
  push: (message: string, variant?: ToastVariant, timeoutMs?: number) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

const variantStyles: Record<ToastVariant, string> = {
  success: 'bg-green-600 border-green-500',
  error: 'bg-red-600 border-red-500',
  warning: 'bg-amber-500 border-amber-400',
  info: 'bg-indigo-600 border-indigo-500'
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idCounter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const push = useCallback((message: string, variant: ToastVariant = 'info', timeoutMs = 3000) => {
    const id = `${Date.now()}_${idCounter.current++}`;
    const toast: ToastItem = { id, message, variant, timeout: timeoutMs };
    setToasts(prev => [...prev, toast]);
    if (timeoutMs > 0) {
      setTimeout(() => dismiss(id), timeoutMs);
    }
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ push, dismiss }}>
      {children}
      <div className="pointer-events-none fixed top-4 right-4 z-50 flex flex-col gap-3 max-w-sm">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`group relative overflow-hidden rounded-md border text-white shadow-md px-4 py-3 text-sm flex items-start gap-3 animate-slideIn`}
          >
            <div className={`absolute inset-0 opacity-90 ${variantStyles[t.variant]}`}></div>
            <div className="relative flex-1 leading-snug">
              {t.message}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="relative ml-auto shrink-0 rounded p-1 text-white/80 hover:text-white hover:bg-white/10 transition pointer-events-auto"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
