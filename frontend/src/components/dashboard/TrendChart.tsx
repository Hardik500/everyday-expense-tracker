import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

interface TrendDataPoint {
  date: string;
  amount: number;
  income: number;
  fullDate: string;
}

interface TrendChartProps {
  data: TrendDataPoint[];
  loading?: boolean;
  range: '7d' | '30d' | '90d';
  onRangeChange: (range: '7d' | '30d' | '90d') => void;
  formatCurrency: (value: number) => string;
  formatFullCurrency: (value: number) => string;
}

// Custom hook for detecting mobile viewport
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [breakpoint]);

  return isMobile;
}

// Touch gesture handler for chart interactions
function useChartGestures(
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void
) {
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd) return;

    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;

    // Check if horizontal swipe is more prominent than vertical
    if (Math.abs(distanceX) > Math.abs(distanceY)) {
      if (Math.abs(distanceX) > minSwipeDistance) {
        if (distanceX > 0 && onSwipeLeft) {
          onSwipeLeft();
        } else if (distanceX < 0 && onSwipeRight) {
          onSwipeRight();
        }
      }
    }

    setTouchStart(null);
    setTouchEnd(null);
  }, [touchStart, touchEnd, onSwipeLeft, onSwipeRight]);

  return { onTouchStart, onTouchMove, onTouchEnd };
}

export function TrendChart({
  data,
  loading = false,
  range,
  onRangeChange,
  formatCurrency,
  formatFullCurrency,
}: TrendChartProps) {
  const isMobile = useIsMobile(768);
  const [activePoint, setActivePoint] = useState<TrendDataPoint | null>(null);

  // Swipe gesture handlers for changing time range
  const swipeHandlers = useChartGestures(
    // Swipe left - go to shorter range
    () => {
      if (range === '90d') onRangeChange('30d');
      else if (range === '30d') onRangeChange('7d');
    },
    // Swipe right - go to longer range
    () => {
      if (range === '7d') onRangeChange('30d');
      else if (range === '30d') onRangeChange('90d');
    }
  );

  // Filter data for mobile (show fewer points to prevent overcrowding)
  const chartData = useMemo(() => {
    if (!isMobile || data.length <= 15) return data;

    // For mobile with lots of data, sample every nth point based on data size
    const sampleRate = Math.ceil(data.length / 15);
    return data.filter((_, index) => index % sampleRate === 0);
  }, [data, isMobile]);

  // Custom tooltip for mobile
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div
        className="bg-bg-card border border-border-color rounded-lg shadow-lg"
        style={{
          padding: isMobile ? '0.75rem' : '1rem',
          fontSize: isMobile ? '0.8125rem' : '0.875rem',
          minWidth: isMobile ? 140 : 180,
        }}
      >
        <div className="font-semibold mb-2 text-text-primary">
          {label}
        </div>
        {payload.map((entry: any, index: number) => (
          <div
            key={index}
            className={`flex items-center justify-between gap-3 ${index < payload.length - 1 ? 'mb-1.5' : ''}`}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: entry.color }}
              />
              <span className="text-text-secondary">
                {entry.name}
              </span>
            </div>
            <span
              className="mono font-medium"
              style={{ color: entry.color }}
            >
              {formatFullCurrency(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // Range selector with visual indicators for swipe hints
  const rangeButtons: Array<{ value: '7d' | '30d' | '90d'; label: string; shortLabel: string }> = [
    { value: '7d', label: '7 Days', shortLabel: '7D' },
    { value: '30d', label: '30 Days', shortLabel: '30D' },
    { value: '90d', label: '90 Days', shortLabel: '90D' },
  ];

  return (
    <div
      className="trend-chart-container relative select-none"
      style={{ WebkitUserSelect: 'none' }}
      {...(isMobile ? swipeHandlers : {})}
    >
      {/* Range Selector */}
      <div className={`flex items-center justify-between flex-wrap gap-3 ${isMobile ? 'mb-4' : 'mb-5'}`}>
        <div className={`flex gap-2 flex-wrap`}>
          {rangeButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => onRangeChange(btn.value)}
              className={`${range === btn.value ? 'primary' : 'secondary'} rounded`}
              style={{
                padding: isMobile ? '0.375rem 0.625rem' : '0.375rem 0.75rem',
                fontSize: isMobile ? '0.75rem' : '0.8125rem',
                minWidth: isMobile ? 44 : 60,
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {isMobile ? btn.shortLabel : btn.label}
            </button>
          ))}
        </div>

        {/* Mobile swipe hint */}
        {isMobile && (
          <div className="flex items-center gap-1 text-[11px] text-text-muted animate-[fadeIn_0.5s_ease]">
            <svg
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            <span>Swipe</span>
            <svg
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14 5l7 7m0 0l-7 7m7-7H3"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Chart */}
      <div
        className="touch-pan-x touch-pan-y"
        style={{
          height: isMobile ? 200 : 280,
        }}
      >
        {loading ? (
          <div className="h-full flex items-center justify-center text-text-muted flex-col gap-3">
            <div
              className="spinner spinner-sm"
              style={{ borderTopColor: 'var(--accent)' }}
            />
            <span className="text-sm">Loading...</span>
          </div>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{
                top: 5,
                right: isMobile ? 10 : 30,
                left: isMobile ? 0 : 20,
                bottom: 5,
              }}
              onMouseMove={(e: any) => {
                if (e.activePayload && e.activePayload[0]) {
                  setActivePoint(e.activePayload[0].payload);
                }
              }}
              onMouseLeave={() => setActivePoint(null)}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border-color)"
                opacity={0.5}
              />
              <XAxis
                dataKey="date"
                stroke="var(--text-muted)"
                fontSize={isMobile ? 9 : 11}
                tickLine={false}
                axisLine={false}
                interval={isMobile ? 'preserveStartEnd' : 0}
                angle={isMobile ? -15 : 0}
                textAnchor={isMobile ? 'end' : 'middle'}
                height={isMobile ? 35 : 30}
                tickMargin={isMobile ? 5 : 10}
              />
              <YAxis
                stroke="var(--text-muted)"
                fontSize={isMobile ? 9 : 11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatCurrency(value)}
                width={isMobile ? 50 : 70}
                tickCount={isMobile ? 4 : 6}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{
                  stroke: 'var(--text-muted)',
                  strokeWidth: 1,
                  strokeDasharray: '4 4',
                }}
              />
              {!isMobile && <Legend />}
              <Line
                type="monotone"
                dataKey="amount"
                name={isMobile ? 'Exp' : 'Expenses'}
                stroke="#ef4444"
                strokeWidth={isMobile ? 2 : 2.5}
                dot={{
                  fill: '#ef4444',
                  strokeWidth: 0,
                  r: isMobile ? 2 : 3,
                }}
                activeDot={{
                  r: isMobile ? 4 : 6,
                  fill: '#ef4444',
                  stroke: '#fff',
                  strokeWidth: 2,
                }}
                isAnimationActive={!isMobile}
                animationDuration={800}
              />
              <Line
                type="monotone"
                dataKey="income"
                name={isMobile ? 'Inc' : 'Income'}
                stroke="#10b981"
                strokeWidth={isMobile ? 2 : 2.5}
                dot={{
                  fill: '#10b981',
                  strokeWidth: 0,
                  r: isMobile ? 2 : 3,
                }}
                activeDot={{
                  r: isMobile ? 4 : 6,
                  fill: '#10b981',
                  stroke: '#fff',
                  strokeWidth: 2,
                }}
                isAnimationActive={!isMobile}
                animationDuration={800}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-text-muted flex-col gap-3">
            <svg
              width={isMobile ? 32 : 40}
              height={isMobile ? 32 : 40}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6m0 0h18m-18 0V5a2 2 0 012-2h2a2 2 0 012 2v6m16 0V5a2 2 0 00-2-2h-2a2 2 0 00-2 2v6m0 0v6"
              />
            </svg>
            <span className="text-sm">
              No data available
            </span>
          </div>
        )}
      </div>

      {/* Mobile summary when hovering/active */}
      {isMobile && activePoint && (
        <div
          className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-4 items-center text-xs backdrop-blur-sm animate-[fadeIn_0.2s_ease]"
          style={{
            background: 'rgba(26, 34, 52, 0.95)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '0.5rem 0.75rem',
          }}
        >
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <span className="text-red-500 font-medium">
              {formatCurrency(activePoint.amount)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-emerald-500 font-medium">
              {formatCurrency(activePoint.income)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default TrendChart;