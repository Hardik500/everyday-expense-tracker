import { useEffect, useCallback, useRef } from 'react';

interface KeyBinding {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  action: () => void;
  description: string;
}

export function useKeyboardShortcuts(keyBindings: KeyBinding[]) {
  const bindingsRef = useRef(keyBindings);
  
  useEffect(() => {
    bindingsRef.current = keyBindings;
  }, [keyBindings]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs or contentEditable
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable ||
      target.closest('[contenteditable="true"]')
    ) {
      return;
    }

    // Don't trigger if any modal is open
    if (document.querySelector('[role="dialog"]')) {
      return;
    }

    for (const binding of bindingsRef.current) {
      const keyMatch = e.key.toLowerCase() === binding.key.toLowerCase();
      const ctrlMatch = !!binding.ctrl === e.ctrlKey;
      const altMatch = !!binding.alt === e.altKey;
      const shiftMatch = !!binding.shift === e.shiftKey;
      const metaMatch = !!binding.meta === e.metaKey;

      if (keyMatch && ctrlMatch && altMatch && shiftMatch && metaMatch) {
        e.preventDefault();
        e.stopPropagation();
        binding.action();
        break;
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export function useFocusTrap(containerRef: React.RefObject<HTMLElement>, isActive: boolean) {
  const focusableElements = useCallback(() => {
    if (!containerRef.current) return [];
    return Array.from(
      containerRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ) as HTMLElement[];
  }, [containerRef]);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const elements = focusableElements();
    const firstElement = elements[0];
    const lastElement = elements[elements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    const container = containerRef.current;
    container.addEventListener('keydown', handleTabKey);
    
    // Focus first element when activated
    firstElement?.focus();

    return () => {
      container.removeEventListener('keydown', handleTabKey);
    };
  }, [isActive, containerRef, focusableElements]);
}

// Common keyboard shortcut definitions
export const COMMON_SHORTCUTS = {
  newTransaction: { key: 'n', ctrl: true, description: 'Add new transaction' },
  search: { key: 'k', ctrl: true, description: 'Open search' },
  escape: { key: 'Escape', description: 'Close modal/Go back' },
  save: { key: 's', ctrl: true, description: 'Save changes' },
  delete: { key: 'Delete', description: 'Delete selected' },
  refresh: { key: 'r', ctrl: true, description: 'Refresh data' },
  dashboard: { key: 'd', alt: true, description: 'Go to Dashboard' },
  transactions: { key: 't', alt: true, description: 'Go to Transactions' },
  analytics: { key: 'a', alt: true, description: 'Go to Analytics' },
  help: { key: '?', shift: true, description: 'Show keyboard shortcuts' },
};

// Hook for help modal
export function useShortcutHelpModal() {
  return useCallback((shortcuts: Record<string, { description: string; keys: string[] }>) => {
    const shortcutList = Object.entries(shortcuts).map(([name, { description, keys }]) => ({
      name,
      description,
      keys: keys.join(' + '),
    }));
    
    return shortcutList;
  }, []);
}

export default useKeyboardShortcuts;
