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
  const sizeMap = {
    sm: { width: 20, height: 20, border: 2 },
    md: { width: 40, height: 40, border: 3 },
    lg: { width: 48, height: 48, border: 3 },
  };

  const spinnerStyle = sizeMap[size];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={text}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        padding: fullHeight ? "3rem" : "1rem",
        minHeight: fullHeight ? "50vh" : "auto",
        ...style,
      }}
    >
      <div
        role="img"
        aria-hidden="true"
        style={{
          width: spinnerStyle.width,
          height: spinnerStyle.height,
          border: `${spinnerStyle.border}px solid var(--border-color)`,
          borderTopColor: "var(--accent)",
          borderRadius: "50%",
          animation: "spin 0.8s cubic-bezier(0.5, 0.1, 0.5, 0.9) infinite",
        }}
      />
      <span
        style={{
          color: "var(--text-muted)",
          fontSize: size === "sm" ? "0.8125rem" : "0.9375rem",
        }}
      >
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
      style={{
        opacity: 0.7,
        ...style,
      }}
    >
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} style={{ padding: "0.875rem 1rem" }}>
          <div
            style={{
              height: "1rem",
              background: "linear-gradient(90deg, var(--bg-input) 0%, var(--bg-card) 50%, var(--bg-input) 100%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.5s ease-in-out infinite",
              borderRadius: "var(--radius-sm)",
              width: i === 0 ? "60%" : "90%",
            }}
          />
        </td>
      ))}
    </tr>
  );
};

interface AccessibleErrorProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  style?: CSSProperties;
}

/** PHASE-6: Accessible error message with retry functionality */
export const AccessibleError: React.FC<AccessibleErrorProps> = ({
  title = "Error",
  message,
  onRetry,
  style = {},
}) => {
  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "3rem",
        textAlign: "center",
        ...style,
      }}
    >
      <svg
        width="48"
        height="48"
        fill="none"
        stroke="var(--danger)"
        viewBox="0 0 24 24"
        role="img"
        aria-hidden="true"
        style={{ marginBottom: "1rem" }}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <h3
        style={{
          fontSize: "1rem",
          fontWeight: 600,
          color: "var(--text-primary)",
          marginBottom: "0.5rem",
        }}
      >
        {title}
      </h3>
      <p
        style={{
          color: "var(--text-muted)",
          fontSize: "0.875rem",
          marginBottom: onRetry ? "1rem" : 0,
          maxWidth: "400px",
        }}
      >
        {message}
      </p>
      {onRetry && (
        <button
          className="primary"
          onClick={onRetry}
          style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
        >
          Try Again
        </button>
      )}
    </div>
  );
};

interface AccessibleButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  ariaLabel?: string;
  style?: CSSProperties;
}

/** PHASE-6: Accessible button with loading state */
export const AccessibleButton: React.FC<AccessibleButtonProps> = ({
  children,
  onClick,
  disabled,
  loading,
  variant = "primary",
  ariaLabel,
  style = {},
}) => {
  const isDisabled = disabled || loading;

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      aria-label={ariaLabel}
      aria-busy={loading}
      aria-disabled={isDisabled}
      className={variant}
      style={{
        position: "relative",
        opacity: isDisabled ? 0.6 : 1,
        cursor: isDisabled ? "not-allowed" : "pointer",
        ...style,
      }}
    >
      {loading && (
        <span
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            width: "1rem",
            height: "1rem",
            border: "2px solid transparent",
            borderTopColor: "currentColor",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
      )}
      <span style={{ opacity: loading ? 0 : 1 }}>{children}</span>
    </button>
  );
};

interface AccessibleTableProps {
  headers: string[];
  children: React.ReactNode;
  ariaLabel?: string;
  isLoading?: boolean;
}

/** PHASE-6: Accessible table with proper ARIA attributes */
export const AccessibleTable: React.FC<AccessibleTableProps> = ({
  headers,
  children,
  ariaLabel = "Data table",
  isLoading = false,
}) => {
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        role="table"
        aria-label={ariaLabel}
        aria-busy={isLoading}
        style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}
      >
        <thead role="rowgroup">
          <tr role="row">
            {headers.map((header, i) => (
              <th
                key={i}
                role="columnheader"
                scope="col"
                style={{
                  background: "var(--bg-secondary)",
                  padding: "0.875rem 1rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--text-muted)",
                  textAlign: "left",
                  borderBottom: "1px solid var(--border-color)",
                }}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup">{children}</tbody>
      </table>
    </div>
  );
};
