import React, { createContext, useContext, useCallback, useState } from 'react';
import ToastContainer, { ToastMessage, ToastType } from '../components/common/Toast';

interface ToastContextValue {
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  addSuccess: (title: string, message?: string) => void;
  addError: (title: string, message?: string) => void;
  addInfo: (title: string, message?: string) => void;
  addWarning: (title: string, message?: string) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const addSuccess = useCallback((title: string, message?: string) => {
    addToast({ type: 'success', title, message, duration: 4000 });
  }, [addToast]);

  const addError = useCallback((title: string, message?: string) => {
    addToast({ type: 'error', title, message, duration: 6000 });
  }, [addToast]);

  const addInfo = useCallback((title: string, message?: string) => {
    addToast({ type: 'info', title, message, duration: 4000 });
  }, [addToast]);

  const addWarning = useCallback((title: string, message?: string) => {
    addToast({ type: 'warning', title, message, duration: 5000 });
  }, [addToast]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider
      value={{ addToast, addSuccess, addError, addInfo, addWarning, dismissToast }}
    >
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToastContext(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToastContext must be used within ToastProvider');
  }
  return context;
}
