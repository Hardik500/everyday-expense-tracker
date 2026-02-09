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
  <div className="card loading-container">
    <div className="spinner spinner-lg" />
    <span className="loading-text">{text}</span>
  </div>
);

export default Loading;