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
          <div className={`skeleton-text-group ${className}`}>
            {Array.from({ length: lines }).map((_, i) => (
              <div
                key={i}
                className="skeleton skeleton-text"
                style={{
                  width: i === 0 ? '80%' : i === lines - 1 ? '60%' : '100%',
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        );
      
      case 'card':
        return (
          <div className={`skeleton-card ${className}`}>
            <div className="skeleton skeleton-header" style={{ width: '60%', marginBottom: 16 }} />
            <div className="skeleton skeleton-content" style={{ height: 100 }} />
            <div className="skeleton-flex" style={{ marginTop: 16, gap: 8 }}>
              <div className="skeleton" style={{ width: 80, height: 32 }} />
              <div className="skeleton" style={{ width: 80, height: 32 }} />
            </div>
          </div>
        );

      case 'table':
        return (
          <div className={`skeleton-table ${className}`}>
            <div className="skeleton-row skeleton-header" style={{ marginBottom: 8 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ flex: 1, height: 24 }} />
              ))}
            </div>
            {Array.from({ length: lines }).map((_, rowIndex) => (
              <div key={rowIndex} className="skeleton-row">
                {Array.from({ length: 4 }).map((_, colIndex) => (
                  <div
                    key={colIndex}
                    className="skeleton"
                    style={{
                      flex: 1,
                      height: 40,
                      animationDelay: `${rowIndex * 0.05 + colIndex * 0.02}s`,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        );

      case 'chart':
        return (
          <div className={`skeleton-chart ${className}`} style={{ padding: 20 }}>
            <div className="skeleton" style={{ width: '40%', height: 24, marginBottom: 20 }} />
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 200 }}>
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className="skeleton"
                  style={{
                    flex: 1,
                    height: `${20 + Math.random() * 60}%`,
                    borderRadius: 4,
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              ))}
            </div>
          </div>
        );

      case 'avatar':
        return (
          <div className={`skeleton-avatar ${className}`} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div className="skeleton" style={{ width: 48, height: 48, borderRadius: '50%' }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton skeleton-text" style={{ width: '50%', marginBottom: 8 }} />
              <div className="skeleton skeleton-text" style={{ width: '30%' }} />
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
      <style>{`
        .skeleton-text-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .skeleton-card {
          padding: 20px;
          background: var(--bg-card);
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-color);
        }
        
        .skeleton-flex {
          display: flex;
        }
        
        .skeleton-table {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .skeleton-row {
          display: flex;
          gap: 12px;
        }
        
        .skeleton-row.skeleton-header {
          margin-bottom: 8px;
        }
        
        .skeleton-chart {
          background: var(--bg-card);
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-color);
        }
        
        .skeleton-avatar {
          padding: 12px;
        }
        
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .skeleton {
          background: linear-gradient(
            90deg,
            var(--bg-input) 25%,
            var(--bg-card) 50%,
            var(--bg-input) 75%
          );
          background-size: 200% 100%;
          animation: skeleton-shimmer 1.5s ease-in-out infinite;
          border-radius: var(--radius-sm);
        }
        
        @keyframes skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </>
  );
};

// Page skeleton for dashboard
export const DashboardSkeleton: React.FC = () => (
  <div className="page-transition-scale" style={{ display: 'grid', gap: '1.5rem' }}>
    {</* Header */ >}
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <div className="skeleton" style={{ width: 200, height: 40, borderRadius: 8 }} />
    </div>

    {</* Stat cards */ >}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="skeleton"
          style={{ height: 140, borderRadius: 'var(--radius-lg)', animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </div>

    {</* Chart */ >}
    <Skeleton type="chart" />

    {</* Budget card */ >}
    <Skeleton type="card" />
  </div>
);

// Table skeleton
export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <Skeleton type="table" lines={rows} />
);

export default Skeleton;
