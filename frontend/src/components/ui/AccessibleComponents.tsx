import React from "react";
import type { CSSProperties } from "react";

interface LoadingStateProps {
  size?: "sm" | "md" | "lg";
  text?: string;
  fullHeight?: boolean;
  style?: CSSProperties;
}

/** PHASE-6: Accessible loading component with proper ARIA attributes */
export const AccessibleLoading: React.FC<LoadingStateProps> = ({
  size = "md",
  text = "Loading...",
  fullHeight = false,
  style = {},
}) => {
  const sizeClasses = {
    sm: "w-5 h-5 border-2",
    md: "w-10 h-10 border-3",
    lg: "w-12 h-12 border-3",
  };

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={text}
      className={`flex flex-col items-center justify-center gap-4 ${fullHeight ? "py-12 min-h-[50vh]" : "py-4"}`}
      style={style}
    >
      <div
        role="img"
        aria-hidden="true"
        className={`${sizeClasses[size]} border-border-color border-t-accent rounded-full animate-spin`}
      />
      <span className={`text-text-muted ${size === "sm" ? "text-sm" : "text-base"}`}>
        {text}
      </span>
    </div>
  );
};

interface SkeletonRowProps {
  columns: number;
  style?: CSSProperties;
}

/** PHASE-6: Accessible skeleton loading row */
export const SkeletonRow: React.FC<SkeletonRowProps> = ({ columns, style }) => {
  return (
    <tr
      role="row"
      aria-hidden="true"
      className="opacity-70"
      style={style}
    >
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-4">
          <div
            className="h-4 rounded animate-pulse"
            style={{
              background: "linear-gradient(90deg, var(--bg-input) 0%, var(--bg-card) 50%, var(--bg-input) 100%)",
              backgroundSize: "200% 100%",
              width: i === 0 ? "60%" : "90%",
            }}
          />
        </td>
      ))}
    </tr>
  );
};
