import { useState, useCallback, useRef, useEffect } from "react";

interface PullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number; // pixels to pull before triggering refresh
  maxPullDistance?: number; // maximum pixels user can pull
  disabled?: boolean;
}

interface PullToRefreshState {
  isPulling: boolean;
  pullProgress: number; // 0 to 1 based on threshold
  isRefreshing: boolean;
  pullY: number; // current pull distance
}

export function usePullToRefresh(options: PullToRefreshOptions) {
  const { onRefresh, threshold = 120, maxPullDistance = 180, disabled = false } = options;
  
  const [state, setState] = useState<PullToRefreshState>({
    isPulling: false,
    pullProgress: 0,
    isRefreshing: false,
    pullY: 0,
  });
  
  const startY = useRef<number>(0);
  const currentY = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isTouch = useRef<boolean>(false);
  const refreshTriggered = useRef<boolean>(false);

  const isAtTop = useCallback(() => {
    if (!containerRef.current) return false;
    // Check if scroll is at top
    return containerRef.current.scrollTop <= 0;
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled) return;
    
    // Only enable on mobile/touch devices
    isTouch.current = true;
    
    if (!isAtTop()) return;
    
    startY.current = e.touches[0].clientY;
    currentY.current = startY.current;
    refreshTriggered.current = false;
    
    setState(prev => ({ ...prev, isPulling: true }));
  }, [disabled, isAtTop]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (disabled || !state.isPulling) return;
    
    currentY.current = e.touches[0].clientY;
    const deltaY = currentY.current - startY.current;
    
    // Only pull down
    if (deltaY <= 0) {
      setState(prev => ({ ...prev, pullY: 0, pullProgress: 0 }));
      return;
    }
    
    // Prevent default scrolling when pulling
    if (deltaY > 0 && isAtTop()) {
      e.preventDefault();
    }
    
    // Calculate pull distance with resistance
    const pullDistance = Math.min(deltaY * 0.5, maxPullDistance);
    const progress = Math.min(pullDistance / threshold, 1);
    
    setState(prev => ({
      ...prev,
      pullY: pullDistance,
      pullProgress: progress,
    }));
  }, [disabled, state.isPulling, threshold, maxPullDistance, isAtTop]);

  const handleTouchEnd = useCallback(async () => {
    if (disabled) return;
    
    if (!refreshTriggered.current && state.pullProgress >= 1 && !state.isRefreshing) {
      refreshTriggered.current = true;
      setState(prev => ({ ...prev, isRefreshing: true }));
      
      try {
        await onRefresh();
      } finally {
        // Keep showing refresh for at least 500ms for visual feedback
        setTimeout(() => {
          setState({
            isPulling: false,
            pullProgress: 0,
            isRefreshing: false,
            pullY: 0,
          });
        }, 500);
      }
    } else {
      // Reset if not triggered
      setState({
        isPulling: false,
        pullProgress: 0,
        isRefreshing: false,
        pullY: 0,
      });
    }
  }, [disabled, state.pullProgress, state.isRefreshing, onRefresh]);

  // Mouse fallback for desktop testing
  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (disabled || isTouch.current) return;
    
    if (!isAtTop()) return;
    
    startY.current = e.clientY;
    currentY.current = startY.current;
    refreshTriggered.current = false;
    
    setState(prev => ({ ...prev, isPulling: true }));
  }, [disabled, isAtTop]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (disabled || isTouch.current || !state.isPulling) return;
    
    currentY.current = e.clientY;
    const deltaY = currentY.current - startY.current;
    
    if (deltaY <= 0) {
      setState(prev => ({ ...prev, pullY: 0, pullProgress: 0 }));
      return;
    }
    
    const pullDistance = Math.min(deltaY * 0.5, maxPullDistance);
    const progress = Math.min(pullDistance / threshold, 1);
    
    setState(prev => ({
      ...prev,
      pullY: pullDistance,
      pullProgress: progress,
    }));
  }, [disabled, state.isPulling, threshold, maxPullDistance]);

  const handleMouseUp = useCallback(() => {
    if (isTouch.current) return;
    handleTouchEnd();
  }, [handleTouchEnd]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Touch events
    container.addEventListener("touchstart", handleTouchStart, { passive: false });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd);
    container.addEventListener("touchcancel", handleTouchEnd);

    // Mouse events for desktop
    container.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("touchcancel", handleTouchEnd);
      container.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, handleMouseDown, handleMouseMove, handleMouseUp]);

  return {
    containerRef,
    ...state,
  };
}

export default usePullToRefresh;
