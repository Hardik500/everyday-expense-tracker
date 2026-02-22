import React from "react";

interface PullToRefreshIndicatorProps {
  isPulling: boolean;
  pullProgress: number;
  isRefreshing: boolean;
  pullY: number;
}

const PullToRefreshIndicator: React.FC<PullToRefreshIndicatorProps> = ({
  isPulling,
  pullProgress,
  isRefreshing,
  pullY,
}) => {
  if (!isPulling && !isRefreshing) return null;

  const rotation = Math.min(pullProgress * 180, 180);
  const opacity = Math.min(pullProgress * 1.5, 1);

  return (
    <div
      className="absolute top-0 left-0 right-0 overflow-hidden z-[100] flex items-end justify-center pb-3 pointer-events-none"
      style={{
        height: `${Math.max(pullY, isRefreshing ? 60 : 0)}px`,
        transition: isRefreshing ? "height 0.3s ease" : "none",
      }}
    >
      <div
        className="flex items-center gap-2"
        style={{
          opacity: isRefreshing ? 1 : opacity,
          transform: `translateY(${isRefreshing ? 0 : Math.max(0, 20 - pullY * 0.2)}px)`,
          transition: isRefreshing ? "all 0.3s ease" : "none",
        }}
      >
        {/* Spinner or Arrow */}
        <div
          className="w-6 h-6 rounded-full border-2 border-border-color flex items-center justify-center"
          style={{
            borderTopColor: isRefreshing ? "var(--accent)" : pullProgress >= 1 ? "var(--accent)" : "var(--text-muted)",
            transform: isRefreshing ? "rotate(360deg)" : `rotate(${rotation}deg)`,
            transition: isRefreshing
              ? "transform 1s linear"
              : pullProgress >= 1
                ? "transform 0.3s ease, border-color 0.2s ease"
                : "none",
            animation: isRefreshing ? "spin 0.8s linear infinite" : "none",
          }}
        >
          {!isRefreshing && (
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke={pullProgress >= 1 ? "var(--accent)" : "var(--text-muted)"}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-opacity"
              style={{
                transform: `rotate(${-rotation}deg)`,
                opacity: pullProgress > 0.1 ? 1 : 0,
              }}
            >
              <polyline points="18,15 12,9 6,15" />
            </svg>
          )}
        </div>

        {/* Text */}
        <span
          className="text-sm font-medium transition-colors"
          style={{
            color: isRefreshing
              ? "var(--accent)"
              : pullProgress >= 1
                ? "var(--accent)"
                : "var(--text-muted)",
          }}
        >
          {isRefreshing
            ? "Refreshing..."
            : pullProgress >= 1
              ? "Release to refresh"
              : "Pull to refresh"}
        </span>
      </div>
    </div>
  );
};

export default PullToRefreshIndicator;
