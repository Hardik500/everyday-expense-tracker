import React from "react";

type LoadingProps = {
  size?: "sm" | "md" | "lg";
  text?: string;
  className?: string;
  inline?: boolean;
};

export const Loading = ({ size = "md", text, className = "", inline = false }: LoadingProps) => {
  const sizeClasses = {
    sm: "spinner-sm",
    md: "",
    lg: "spinner-lg",
  };

  return (
    <div className={`${inline ? "inline-flex items-center gap-2" : "loading-container"} ${className}`}>
      <div className={`spinner ${sizeClasses[size]}`} />
      {text && <span className="loading-text">{text}</span>}
    </div>
  );
};

export const LoadingSkeleton = ({ lines = 3 }: { lines?: number }) => (
  <div className="flex flex-col gap-2 p-4">
    {Array.from({ length: lines }).map((_, i) => (
      <div
        key={i}
        className={`skeleton ${i === lines - 1 ? "skeleton-text-sm" : "skeleton-text"}`}
        style={{ width: i === 0 ? "80%" : i === 1 ? "60%" : "40%" }}
      />
    ))}
  </div>
);

export const PageLoading = ({ text = "Loading..." }: { text?: string }) => (
  <div className="loading-container">
    <div className="spinner spinner-lg" />
    <span className="loading-text">{text}</span>
  </div>
);

export const LoadingOverlay = ({ text = "Loading..." }: { text?: string }) => (
  <div style={{
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(10, 15, 26, 0.8)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  }}>
    <div style={{ textAlign: "center" }}>
      <div className="spinner spinner-lg" />
      <span style={{ display: "block", marginTop: "1rem", color: "var(--text-secondary)" }}>{text}</span>
    </div>
  </div>
);

export default Loading;