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
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: `${Math.max(pullY, isRefreshing ? 60 : 0)}px`,
        overflow: "hidden",
        zIndex: 100,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        paddingBottom: "12px",
        transition: isRefreshing ? "height 0.3s ease" : "none",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          opacity: isRefreshing ? 1 : opacity,
          transform: `translateY(${isRefreshing ? 0 : Math.max(0, 20 - pullY * 0.2)}px)`,
          transition: isRefreshing ? "all 0.3s ease" : "none",
        }}
      >
        {/* Spinner or Arrow */}
        <div
          style={{
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            border: "2px solid var(--border-color)",
            borderTopColor: isRefreshing ? "var(--accent)" : pullProgress >= 1 ? "var(--accent)" : "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
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
          style={{
            fontSize: "14px",
            fontWeight: 500,
            color: isRefreshing 
              ? "var(--accent)" 
              : pullProgress >= 1 
                ? "var(--accent)" 
                : "var(--text-muted)",
            transition: "color 0.2s ease",
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
