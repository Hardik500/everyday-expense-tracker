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
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: isMobile ? '0.75rem' : '1rem',
          boxShadow: 'var(--shadow-lg)',
          fontSize: isMobile ? '0.8125rem' : '0.875rem',
          minWidth: isMobile ? 140 : 180,
        }}
      >
        <div
          style={{
            fontWeight: 600,
            marginBottom: '0.5rem',
            color: 'var(--text-primary)',
          }}
        >
          {label}
        </div>
        {payload.map((entry: any, index: number) => (
          <div
            key={index}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              marginBottom: index < payload.length - 1 ? '0.375rem' : 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: entry.color,
                }}
              />
              <span style={{ color: 'var(--text-secondary)' }}>
                {entry.name}
              </span>
            </div>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 500,
                color: entry.color,
              }}
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
      className="trend-chart-container"
      style={{
        position: 'relative',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
      {...(isMobile ? swipeHandlers : {})}
    >
      {/* Range Selector */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: isMobile ? '1rem' : '1.25rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: isMobile ? '0.375rem' : '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          {rangeButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => onRangeChange(btn.value)}
              className={range === btn.value ? 'primary' : 'secondary'}
              style={{
                padding: isMobile ? '0.375rem 0.625rem' : '0.375rem 0.75rem',
                fontSize: isMobile ? '0.75rem' : '0.8125rem',
                borderRadius: 'var(--radius-sm)',
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.6875rem',
              color: 'var(--text-muted)',
              animation: 'fadeIn 0.5s ease',
            }}
          >
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
        style={{
          height: isMobile ? 200 : 280,
          touchAction: 'pan-x pan-y pinch-zoom',
        }}
      >
        {loading ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div
              className="spinner spinner-sm"
              style={{ borderTopColor: 'var(--accent)' }}
            />
            <span style={{ fontSize: '0.8125rem' }}>Loading...</span>
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
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
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
            <span style={{ fontSize: isMobile ? '0.8125rem' : '0.875rem' }}>
              No data available
            </span>
          </div>
        )}
      </div>
      
      {/* Mobile summary when hovering/active */}
      {isMobile && activePoint && (
        <div
          style={{
            position: 'absolute',
            bottom: '0.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(26, 34, 52, 0.95)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '0.5rem 0.75rem',
            display: 'flex',
            gap: '1rem',
            alignItems: 'center',
            fontSize: '0.75rem',
            backdropFilter: 'blur(4px)',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#ef4444',
              }}
            />
            <span style={{ color: '#ef4444', fontWeight: 500 }}>
              {formatCurrency(activePoint.amount)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#10b981',
              }}
            />
            <span style={{ color: '#10b981', fontWeight: 500 }}>
              {formatCurrency(activePoint.income)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default TrendChart;
