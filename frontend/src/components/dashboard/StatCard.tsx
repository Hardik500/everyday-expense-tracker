import { ReactNode } from "react";

type TrendType = "up" | "down" | "neutral";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  trend?: {
    value: number;
    label: string;
    type: TrendType;
  };
  variant?: "default" | "success" | "danger" | "warning" | "purple";
  size?: "small" | "medium" | "large";
  className?: string;
}

const variantStyles = {
  default: {
    bg: "bg-bg-card",
    iconBg: "bg-accent-glow",
    iconColor: "text-accent",
    valueColor: "text-text-primary",
  },
  success: {
    bg: "bg-bg-card",
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-500",
    valueColor: "text-emerald-500",
  },
  danger: {
    bg: "bg-bg-card",
    iconBg: "bg-red-500/15",
    iconColor: "text-red-500",
    valueColor: "text-red-500",
  },
  warning: {
    bg: "bg-bg-card",
    iconBg: "bg-amber-500/15",
    iconColor: "text-amber-500",
    valueColor: "text-amber-500",
  },
  purple: {
    bg: "bg-bg-card",
    iconBg: "bg-purple-500/15",
    iconColor: "text-purple-500",
    valueColor: "text-purple-500",
  },
};

const sizeStyles = {
  small: {
    padding: "p-4",
    iconSize: 32,
    titleSize: "text-xs",
    valueSize: "text-xl",
    subtitleSize: "text-[11px]",
    minH: "h-auto",
  },
  medium: {
    padding: "p-5",
    iconSize: 40,
    titleSize: "text-sm",
    valueSize: "text-2xl",
    subtitleSize: "text-xs",
    minH: "h-auto",
  },
  large: {
    padding: "p-6",
    iconSize: 48,
    titleSize: "text-base",
    valueSize: "text-3xl",
    subtitleSize: "text-xs",
    minH: "min-h-[140px]",
  },
};

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  variant = "default",
  size = "medium",
  className = "",
}: StatCardProps) {
  const styles = variantStyles[variant];
  const sizeStyle = sizeStyles[size];

  const TrendIcon = trend?.type === "up" ? (
    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
    </svg>
  ) : trend?.type === "down" ? (
    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
    </svg>
  ) : null;

  const trendColor = trend?.type === "up" ? "text-emerald-500" : trend?.type === "down" ? "text-red-500" : "text-text-muted";

  return (
    <div
      className={`card stat-card ${styles.bg} ${sizeStyle.padding} flex flex-col gap-3 ${sizeStyle.minH} justify-between ${className}`}
    >
      {/* Header with icon and title */}
      <div className="flex items-center gap-3">
        <div
          className="flex-shrink-0 flex items-center justify-center rounded-[10px]"
          style={{
            width: `${sizeStyle.iconSize}px`,
            height: `${sizeStyle.iconSize}px`,
          }}
        >
          <div className={`w-full h-full rounded-[10px] ${styles.iconBg} ${styles.iconColor} flex items-center justify-center`}>
            <span className={`${variant === 'default' ? 'text-accent' : styles.iconColor}`}>
              {icon}
            </span>
          </div>
        </div>
        <span
          className={`${sizeStyle.titleSize} text-text-muted font-medium`}
        >
          {title}
        </span>
      </div>

      {/* Value section */}
      <div>
        <div
          className={`mono font-semibold leading-tight ${variant === 'default' ? styles.valueColor : ''} ${variant === 'success' ? styles.valueColor : ''} ${variant === 'danger' ? styles.valueColor : ''} ${variant === 'warning' ? styles.valueColor : ''} ${variant === 'purple' ? styles.valueColor : ''}`}
          style={{
            fontSize: typeof sizeStyle.valueSize === 'number' ? `${sizeStyle.valueSize}px` : undefined,
          }}
        >
          {value}
        </div>

        {/* Subtitle and/or trend */}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {trend && (
            <div
              className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}
            >
              {TrendIcon}
              <span>{trend.value}%</span>
            </div>
          )}
          {(trend || subtitle) && (
            <span
              className={sizeStyle.subtitleSize}
              style={{ color: "var(--text-muted)" }}
            >
              {trend ? trend.label : subtitle}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Mini chart component for sparklines
interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  variant?: "line" | "area";
}

export function Sparkline({
  data,
  width = 120,
  height = 40,
  color = "var(--accent)",
  variant = "area",
}: SparklineProps) {
  if (!data || data.length === 0) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  });

  const areaPath = `
    ${points.map((p, i) => `${i === 0 ? "M" : "L"} ${p}`).join(" ")}
    L ${width},${height}
    L 0,${height}
    Z
  `;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {variant === "area" && (
        <path d={areaPath} fill="url(#sparklineGradient)" />
      )}
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default StatCard;