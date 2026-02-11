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
    bg: "var(--bg-card)",
    iconBg: "var(--accent-glow)",
    iconColor: "var(--accent)",
    valueColor: "var(--text-primary)",
  },
  success: {
    bg: "var(--bg-card)",
    iconBg: "rgba(16, 185, 129, 0.15)",
    iconColor: "#10b981",
    valueColor: "#10b981",
  },
  danger: {
    bg: "var(--bg-card)",
    iconBg: "rgba(239, 68, 68, 0.15)",
    iconColor: "#ef4444",
    valueColor: "#ef4444",
  },
  warning: {
    bg: "var(--bg-card)",
    iconBg: "rgba(245, 158, 11, 0.15)",
    iconColor: "#f59e0b",
    valueColor: "#f59e0b",
  },
  purple: {
    bg: "var(--bg-card)",
    iconBg: "rgba(139, 92, 246, 0.15)",
    iconColor: "#8b5cf6",
    valueColor: "#8b5cf6",
  },
};

const sizeStyles = {
  small: {
    padding: "1rem",
    iconSize: 32,
    titleSize: "0.75rem",
    valueSize: "1.25rem",
    subtitleSize: "0.6875rem",
  },
  medium: {
    padding: "1.25rem",
    iconSize: 40,
    titleSize: "0.8125rem",
    valueSize: "1.75rem",
    subtitleSize: "0.75rem",
  },
  large: {
    padding: "1.5rem",
    iconSize: 48,
    titleSize: "0.875rem",
    valueSize: "2.25rem",
    subtitleSize: "0.8125rem",
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

  const trendColor = trend?.type === "up" ? "#10b981" : trend?.type === "down" ? "#ef4444" : "var(--text-muted)";

  return (
    <div
      className={`card stat-card ${className}`}
      style={{
        padding: sizeStyle.padding,
        background: styles.bg,
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        minHeight: sizeStyle === sizeStyles.large ? "140px" : "auto",
        justifyContent: "space-between",
      }}
    >
      {/* Header with icon and title */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <div
          style={{
            width: sizeStyle.iconSize,
            height: sizeStyle.iconSize,
            borderRadius: "10px",
            background: styles.iconBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: styles.iconColor,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <span
          style={{
            fontSize: sizeStyle.titleSize,
            color: "var(--text-muted)",
            fontWeight: 500,
          }}
        >
          {title}
        </span>
      </div>

      {/* Value section */}
      <div>
        <div
          className="mono"
          style={{
            fontSize: sizeStyle.valueSize,
            fontWeight: 600,
            color: styles.valueColor,
            lineHeight: 1.2,
          }}
        >
          {value}
        </div>

        {/* Subtitle and/or trend */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            marginTop: "0.375rem",
            flexWrap: "wrap",
          }}
        >
          {trend && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
                color: trendColor,
                fontSize: "0.75rem",
                fontWeight: 500,
              }}
            >
              {TrendIcon}
              <span>{trend.value}%</span>
            </div>
          )}
          {(trend || subtitle) && (
            <span
              style={{
                fontSize: sizeStyle.subtitleSize,
                color: "var(--text-muted)",
              }}
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
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: "visible" }}>
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
