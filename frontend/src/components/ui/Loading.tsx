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

export const LoadingSkeleton = ({ lines = 3 }: { lines?: number }) => {
  const widths = ['w-4/5', 'w-3/5', 'w-2/5'];
  return (
    <div className="flex flex-col gap-2 p-4">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`skeleton ${i === lines - 1 ? "skeleton-text-sm" : "skeleton-text"} ${widths[i]}`}
        />
      ))}
    </div>
  );
};

export const PageLoading = ({ text = "Loading..." }: { text?: string }) => (
  <div className="loading-container">
    <div className="spinner spinner-lg" />
    <span className="loading-text">{text}</span>
  </div>
);

export const LoadingOverlay = ({ text = "Loading..." }: { text?: string }) => (
  <div className="fixed inset-0 bg-[#0a151a]/80 backdrop-blur-sm flex items-center justify-center z-[9999]">
    <div className="text-center">
      <div className="spinner spinner-lg" />
      <span className="block mt-4 text-text-secondary">{text}</span>
    </div>
  </div>
);

export default Loading;