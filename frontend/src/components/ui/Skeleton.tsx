import React from 'react';

interface SkeletonProps {
  lines?: number;
  type?: 'text' | 'card' | 'table' | 'chart' | 'avatar';
  count?: number;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  lines = 3,
  type = 'text',
  count = 1,
  className = '',
}) => {
  const renderSkeleton = () => {
    switch (type) {
      case 'text':
        return (
          <div className={`flex flex-col gap-2 ${className}`}>
            {Array.from({ length: lines }).map((_, i) => (
              <div
                key={i}
                className={`h-4 rounded animate-pulse ${i === 0 ? 'w-4/5' : i === lines - 1 ? 'w-3/5' : 'w-full'}`}
                style={{ animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
        );

      case 'card':
        return (
          <div className={`p-5 bg-bg-card rounded-lg border border-border-color ${className}`}>
            <div className="h-6 w-3/5 mb-4 rounded animate-pulse" />
            <div className="h-[100px] w-full rounded animate-pulse" />
            <div className="flex gap-2 mt-4">
              <div className="w-20 h-8 rounded animate-pulse" />
              <div className="w-20 h-8 rounded animate-pulse" />
            </div>
          </div>
        );

      case 'table':
        return (
          <div className={`flex flex-col gap-1 ${className}`}>
            <div className="flex gap-3 mb-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex-1 h-6 rounded animate-pulse" />
              ))}
            </div>
            {Array.from({ length: lines }).map((_, rowIndex) => (
              <div key={rowIndex} className="flex gap-3">
                {Array.from({ length: 4 }).map((_, colIndex) => (
                  <div
                    key={colIndex}
                    className="flex-1 h-10 rounded animate-pulse"
                    style={{ animationDelay: `${rowIndex * 0.05 + colIndex * 0.02}s` }}
                  />
                ))}
              </div>
            ))}
          </div>
        );

      case 'chart':
        return (
          <div className={`p-5 bg-bg-card rounded-lg border border-border-color ${className}`}>
            <div className="h-6 w-2/5 mb-5 rounded animate-pulse" />
            <div className="flex items-end gap-2 h-[200px]">
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 rounded animate-pulse"
                  style={{
                    height: `${20 + Math.random() * 60}%`,
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              ))}
            </div>
          </div>
        );

      case 'avatar':
        return (
          <div className={`flex items-center gap-3 p-3 ${className}`}>
            <div className="w-12 h-12 rounded-full animate-pulse" />
            <div className="flex-1">
              <div className="h-4 w-1/2 mb-2 rounded animate-pulse" />
              <div className="h-4 w-1/3 rounded animate-pulse" />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ animationDelay: `${i * 0.15}s` }}>
          {renderSkeleton()}
        </div>
      ))}
    </>
  );
};

// Page skeleton for dashboard
export const DashboardSkeleton: React.FC = () => (
  <div className="grid gap-6">
    {/* Header */}
    <div className="flex items-center gap-4">
      <div className="w-[200px] h-10 rounded-lg animate-pulse" />
    </div>

    {/* Stat cards */}
    <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-[140px] rounded-lg animate-pulse"
          style={{ animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </div>

    {/* Chart */}
    <Skeleton type="chart" />

    {/* Budget card */}
    <Skeleton type="card" />
  </div>
);

// Table skeleton
export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <Skeleton type="table" lines={rows} />
);

export default Skeleton;
