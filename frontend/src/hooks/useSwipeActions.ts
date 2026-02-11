import { useState, useCallback, useRef, useEffect } from "react";

interface SwipeAction {
  label: string;
  color: string;
  icon?: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}

interface UseSwipeActionsOptions {
  threshold?: number;
  actions: SwipeAction[];
  disabled?: boolean;
  onSwipeStart?: () => void;
  onSwipeEnd?: () => void;
}

interface SwipeState {
  isSwiping: boolean;
  translateX: number;
  swipedOpen: boolean;
  isClosing: boolean;
}

export function useSwipeActions(options: UseSwipeActionsOptions) {
  const { threshold = 80, actions, disabled = false, onSwipeStart, onSwipeEnd } = options;
  
  const [state, setState] = useState<SwipeState>({
    isSwiping: false,
    translateX: 0,
    swipedOpen: false,
    isClosing: false,
  });
  
  const startX = useRef<number>(0);
  const currentX = useRef<number>(0);
  const elementRef = useRef<HTMLDivElement>(null);
  const isTouch = useRef<boolean>(false);
  const hasMoved = useRef<boolean>(false);

  const maxSwipe = Math.min(actions.length * threshold, 240);

  const resetState = useCallback(() => {
    setState({
      isSwiping: false,
      translateX: 0,
      swipedOpen: false,
      isClosing: false,
    });
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled) return;
    
    isTouch.current = true;
    hasMoved.current = false;
    startX.current = e.touches[0].clientX;
    currentX.current = startX.current;
    
    setState(prev => ({ ...prev, isSwiping: true, isClosing: false }));
    onSwipeStart?.();
  }, [disabled, onSwipeStart]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (disabled || !state.isSwiping) return;
    
    currentX.current = e.touches[0].clientX;
    const deltaX = startX.current - currentX.current;
    
    // Only handle horizontal swipes
    if (Math.abs(deltaX) > 10) {
      hasMoved.current = true;
      
      // Only swipe left (negative translateX)
      const newTranslateX = Math.max(-maxSwipe, Math.min(0, -deltaX));
      setState(prev => ({ ...prev, translateX: newTranslateX }));
    }
  }, [disabled, state.isSwiping, maxSwipe]);

  const handleTouchEnd = useCallback(() => {
    if (disabled) return;
    
    const deltaX = startX.current - currentX.current;
    
    if (hasMoved.current && deltaX > threshold / 2) {
      // Swipe far enough - open
      setState({
        isSwiping: false,
        translateX: -maxSwipe,
        swipedOpen: true,
        isClosing: false,
      });
    } else {
      // Snap back
      setState(prev => ({
        ...prev,
        isSwiping: false,
        translateX: 0,
        swipedOpen: false,
        isClosing: state.swipedOpen,
      }));
    }
    
    onSwipeEnd?.();
  }, [disabled, threshold, maxSwipe, state.swipedOpen, onSwipeEnd]);

  // Mouse fallback for desktop
  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (disabled || isTouch.current) return;
    
    hasMoved.current = false;
    startX.current = e.clientX;
    currentX.current = startX.current;
    
    setState(prev => ({ ...prev, isSwiping: true, isClosing: false }));
    onSwipeStart?.();
  }, [disabled, onSwipeStart]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (disabled || isTouch.current || !state.isSwiping) return;
    
    currentX.current = e.clientX;
    const deltaX = startX.current - currentX.current;
    
    if (Math.abs(deltaX) > 10) {
      hasMoved.current = true;
      const newTranslateX = Math.max(-maxSwipe, Math.min(0, -deltaX));
      setState(prev => ({ ...prev, translateX: newTranslateX }));
    }
  }, [disabled, state.isSwiping, maxSwipe]);

  const handleMouseUp = useCallback(() => {
    if (isTouch.current) return;
    handleTouchEnd();
  }, [handleTouchEnd]);

  // Close this swipe item when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (elementRef.current && !elementRef.current.contains(e.target as Node)) {
        if (state.swipedOpen) {
          setState(prev => ({
            ...prev,
            translateX: 0,
            swipedOpen: false,
            isClosing: true,
          }));
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [state.swipedOpen]);

  // Attach events
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Touch events
    element.addEventListener("touchstart", handleTouchStart, { passive: true });
    element.addEventListener("touchmove", handleTouchMove, { passive: true });
    element.addEventListener("touchend", handleTouchEnd);
    element.addEventListener("touchcancel", handleTouchEnd);

    // Mouse events
    element.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchmove", handleTouchMove);
      element.removeEventListener("touchend", handleTouchEnd);
      element.removeEventListener("touchcancel", handleTouchEnd);
      element.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, handleMouseDown, handleMouseMove, handleMouseUp]);

  return {
    elementRef,
    ...state,
    maxSwipe,
    resetState,
    hasMoved: hasMoved.current,
  };
}

export default useSwipeActions;
