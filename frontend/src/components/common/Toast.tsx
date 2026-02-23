import { useEffect, useState, useCallback, createContext, useContext } from "react";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (type: ToastType, message: string) => void;
  dismissToast: (id: string) => void;
  ToastContainer: () => JSX.Element;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Return mock functions if context not available
    return {
      toasts: [],
      addToast: () => {},
      dismissToast: () => {},
      ToastContainer: () => <></>,
    };
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const ToastContainerComponent = useCallback(() => (
    <ToastContainer toasts={toasts} onDismiss={dismissToast} />
  ), [toasts, dismissToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, dismissToast, ToastContainer: ToastContainerComponent }}>
      {children}
    </ToastContext.Provider>
  );
}

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

export function ToastItem({ toast, onDismiss }: ToastItemProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-emerald-500" />,
    error: <AlertCircle className="w-5 h-5 text-rose-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
  };

  const bgColors = {
    success: "bg-emerald-500/10 border-emerald-500/20",
    error: "bg-rose-500/10 border-rose-500/20",
    info: "bg-blue-500/10 border-blue-500/20",
  };

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${bgColors[toast.type]} shadow-lg backdrop-blur-sm animate-slide-in`}
      role="alert"
    >
      {icons[toast.type]}
      <p className="flex-1 text-sm text-[var(--text-primary)]">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-1 hover:bg-[var(--bg-primary)] rounded transition-colors"
      >
        <X className="w-4 h-4 text-[var(--text-muted)]" />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}
