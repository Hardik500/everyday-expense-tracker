import { useEffect, useState } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export type ToastMessage = {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
};

type Props = {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
};

const icons: Record<ToastType, JSX.Element> = {
  success: (
    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  info: (
    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
};

const colors: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: { bg: "rgba(16, 185, 129, 0.15)", border: "var(--success)", icon: "var(--success)" },
  error: { bg: "rgba(239, 68, 68, 0.15)", border: "var(--danger)", icon: "var(--danger)" },
  info: { bg: "rgba(99, 102, 241, 0.15)", border: "var(--info)", icon: "var(--info)" },
  warning: { bg: "rgba(245, 158, 11, 0.15)", border: "var(--warning)", icon: "var(--warning)" },
};

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const duration = toast.duration || 4000;
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onDismiss, 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [toast.duration, onDismiss]);

  const color = colors[toast.type];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "0.75rem",
        padding: "1rem 1.25rem",
        background: color.bg,
        borderLeft: `4px solid ${color.border}`,
        borderRadius: "var(--radius-md)",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
        animation: isExiting ? "slideOut 0.3s ease forwards" : "slideIn 0.3s ease",
        minWidth: 280,
        maxWidth: 400,
      }}
    >
      <div style={{ color: color.icon, flexShrink: 0, marginTop: 2 }}>
        {icons[toast.type]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary)" }}>
          {toast.title}
        </div>
        {toast.message && (
          <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            {toast.message}
          </div>
        )}
      </div>
      <button
        onClick={() => {
          setIsExiting(true);
          setTimeout(onDismiss, 300);
        }}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--text-muted)",
          cursor: "pointer",
          padding: "0.25rem",
          marginTop: -2,
          marginRight: -4,
        }}
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

import { createPortal } from "react-dom";

function ToastContainer({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 10000,
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(100%); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideOut {
          from { opacity: 1; transform: translateX(0); }
          to { opacity: 0; transform: translateX(100%); }
        }
      `}</style>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>,
    document.body
  );
}

// Hook for managing toasts
export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (toast: Omit<ToastMessage, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return { toasts, addToast, dismissToast, ToastContainer };
}

export default ToastContainer;
