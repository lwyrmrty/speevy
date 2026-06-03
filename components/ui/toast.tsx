'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type ToastStatus = 'success' | 'error' | 'info';

type Toast = {
  id: number;
  status: ToastStatus;
  text: string;
};

type ShowToastInput = {
  status?: ToastStatus;
  text: string;
  duration?: number;
};

type ToastContextValue = {
  showToast: (input: ShowToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 3500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextIdRef = useRef(0);
  const timeoutsRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timeout = timeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    ({ status = 'info', text, duration = DEFAULT_DURATION }: ShowToastInput) => {
      const id = nextIdRef.current++;
      setToasts((current) => [...current, { id, status, text }]);
      const timeout = setTimeout(() => dismiss(id), duration);
      timeoutsRef.current.set(id, timeout);
    },
    [dismiss],
  );

  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
      timeouts.clear();
    };
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="speevy-toast-viewport" role="region" aria-label="Notifications">
        {toasts.map((toast) => (
          <button
            key={toast.id}
            type="button"
            className={`speevy-toast ${toast.status}`}
            role="status"
            aria-live="polite"
            onClick={() => dismiss(toast.id)}
          >
            {toast.text}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return context;
}
