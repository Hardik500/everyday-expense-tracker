import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon?: React.ReactNode;
  color?: string;
  onClick?: () => void;
}

export function StatCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  color = "var(--accent)",
  onClick,
}: StatCardProps) {
  const TrendIcon =
    trend?.value === 0
      ? Minus
      : trend?.isPositive
      ? TrendingUp
      : TrendingDown;

  return (
    <div
      onClick={onClick}
      className={`bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl p-4 hover:border-[var(--border-hover)] transition-all duration-200 ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-[var(--text-muted)] text-sm font-medium">
          {title}
        </span>
        {icon && (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${color}20`, color: color }}
          >
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-semibold text-[var(--text-primary)]">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {subtitle}
            </p>
          )}
        </div>

        {trend && trend.value !== 0 && (
          <div
            className={`flex items-center gap-1 text-xs font-medium ${
              trend.isPositive
                ? "text-emerald-500"
                : "text-rose-500"
            }`}
          >
            <TrendIcon size={14} />
            <span>
              {trend.isPositive ? "+" : "-"}
              {Math.abs(trend.value).toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
