import { useState, useEffect } from 'react';
import { fetchWithAuth } from '../utils/api';
import { PageLoading } from '../components/ui/Loading';
import PageHeader from '../components/layout/PageHeader';

interface CalendarDayData {
  date: string;
  income: number;
  expenses: number;
  net: number;
  transaction_count: number;
  transactions: any[];
}

interface CashFlowCalendar {
  year: number;
  month: number;
  days: CalendarDayData[];
  month_total: {
    income: number;
    expenses: number;
    net: number;
  };
}

interface Props {
  apiBase: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarPage({ apiBase }: Props) {
  const [calendar, setCalendar] = useState<CashFlowCalendar | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const today = new Date();
  const [viewDate, setViewDate] = useState({
    year: today.getFullYear(),
    month: today.getMonth() + 1
  });

  useEffect(() => {
    fetchCalendar();
  }, [apiBase, viewDate]);

  const fetchCalendar = async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth(
        `${apiBase}/api/v1/calendar/${viewDate.year}/${viewDate.month}`
      );
      if (response.ok) {
        const data = await response.json();
        setCalendar(data);
      }
    } catch (error) {
      console.error('Failed to fetch calendar:', error);
    } finally {
      setLoading(false);
    }
  };

  const goToPrevMonth = () => {
    if (viewDate.month === 1) {
      setViewDate({ year: viewDate.year - 1, month: 12 });
    } else {
      setViewDate({ ...viewDate, month: viewDate.month - 1 });
    }
  };

  const goToNextMonth = () => {
    if (viewDate.month === 12) {
      setViewDate({ year: viewDate.year + 1, month: 1 });
    } else {
      setViewDate({ ...viewDate, month: viewDate.month + 1 });
    }
  };

  const goToToday = () => {
    setViewDate({ year: today.getFullYear(), month: today.getMonth() + 1 });
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month - 1, 1).getDay();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(Math.abs(amount));
  };

  const getDayData = (day: number): CalendarDayData | undefined => {
    if (!calendar) return undefined;
    const dateStr = `${viewDate.year}-${String(viewDate.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return calendar.days.find(d => d.date === dateStr);
  };

  const getNetColor = (net: number) => {
    if (net > 0) return '#22c55e';
    if (net < 0) return '#ef4444';
    return '#6b7280';
  };

  const isToday = (day: number) => {
    return day === today.getDate() && 
           viewDate.month === today.getMonth() + 1 && 
           viewDate.year === today.getFullYear();
  };

  if (loading) return <PageLoading text="Loading calendar..." />;

  const daysInMonth = getDaysInMonth(viewDate.year, viewDate.month);
  const firstDay = getFirstDayOfMonth(viewDate.year, viewDate.month);
  const calendarDays: (number | null)[] = [];

  // Add empty slots for days before the first of month
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }

  // Add days of the month
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

  return (
    <div className="calendar-page">
      <PageHeader
        title="Cash Flow Calendar"
        description="Monthly view of your spending"
      />

      {/* Month Navigation */}
      <div className="calendar-nav">
        <button className="nav-btn" onClick={goToPrevMonth}>
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <div className="current-month">
          <h2>{MONTHS[viewDate.month - 1]} {viewDate.year}</h2>
          <button className="today-btn" onClick={goToToday}>Today</button>
        </div>
        
        <button className="nav-btn" onClick={goToNextMonth}>
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Month Totals */}
      {calendar && (
        <div className="month-totals">
          <div className="total-card income">
            <span className="total-label">Income</span>
            <span className="total-value">+{formatCurrency(calendar.month_total.income)}</span>
          </div>
          <div className="total-card expenses">
            <span className="total-label">Expenses</span>
            <span className="total-value">-{formatCurrency(calendar.month_total.expenses)}</span>
          </div>
          <div className="total-card net" style={{ 
            color: calendar.month_total.net >= 0 ? '#22c55e' : '#ef4444' 
          }}>
            <span className="total-label">Net</span>
            <span className="total-value">
              {calendar.month_total.net >= 0 ? '+' : '-'}{formatCurrency(calendar.month_total.net)}
            </span>
          </div>
        </div>
      )}

      {/* Calendar Grid */}
      <div className="calendar-grid">
        {/* Day Headers */}
        {DAYS.map(day => (
          <div key={day} className="calendar-header">{day}</div>
        ))}

        {/* Calendar Days */}
        {calendarDays.map((day, index) => {
          const dayData = day ? getDayData(day) : null;
          
          return (
            <div 
              key={index} 
              className={`calendar-day ${day ? 'has-data' : 'empty'} ${day && isToday(day) ? 'today' : ''} ${selectedDate === dayData?.date ? 'selected' : ''}`}
              onClick={() => dayData && setSelectedDate(dayData.date)}
            >
              {day && (
                <>
                  <span className="day-number">{day}</span>
                  {dayData && (
                    <div className="day-summary">
                      <div 
                        className="net-value" 
                        style={{ color: getNetColor(dayData.net) }}
                      >
                        {dayData.net >= 0 ? '+' : '-'}{formatCurrency(dayData.net)}
                      </div>
                      {dayData.transaction_count > 0 && (
                        <span className="tx-count">{dayData.transaction_count} txns</span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Day Detail Modal */}
      {selectedDate && (
        <div className="modal-overlay" onClick={() => setSelectedDate(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{new Date(selectedDate).toLocaleDateString('en-IN', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
              })}</h3>
              <button className="close-btn" onClick={() => setSelectedDate(null)}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {calendar && (() => {
              const dayData = calendar.days.find(d => d.date === selectedDate);
              if (!dayData) return <p className="no-data">No transactions on this day</p>;
              
              return (
                <div className="day-details">
                  <div className="detail-row">
                    <span>Income</span>
                    <span className="income">+{formatCurrency(dayData.income)}</span>
                  </div>
                  <div className="detail-row">
                    <span>Expenses</span>
                    <span className="expenses">-{formatCurrency(dayData.expenses)}</span>
                  </div>
                  <div className="detail-row total">
                    <span>Net</span>
                    <span style={{ color: getNetColor(dayData.net) }}>
                      {dayData.net >= 0 ? '+' : '-'}{formatCurrency(dayData.net)}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      <style>{`
        .calendar-page {
          max-width: 1000px;
        }

        .calendar-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }

        .nav-btn {
          background: var(--bg-card, #1a1a2e);
          border: 1px solid var(--border, #2d2d3a);
          border-radius: 8px;
          padding: 10px;
          color: var(--text, #e0e0e0);
          cursor: pointer;
          transition: all 0.15s;
        }

        .nav-btn:hover {
          background: var(--bg-input, #252535);
          border-color: #6366f1;
        }

        .current-month {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .current-month h2 {
          margin: 0;
          font-size: 1.5rem;
          color: var(--text, #e0e0e0);
        }

        .today-btn {
          padding: 6px 12px;
          background: rgba(99, 102, 241, 0.1);
          color: #6366f1;
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: 6px;
          font-size: 0.8125rem;
          cursor: pointer;
        }

        .today-btn:hover {
          background: rgba(99, 102, 241, 0.2);
        }

        .month-totals {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        .total-card {
          background: var(--bg-card, #1a1a2e);
          border: 1px solid var(--border, #2d2d3a);
          border-radius: 12px;
          padding: 16px;
          text-align: center;
        }

        .total-label {
          display: block;
          font-size: 0.8125rem;
          color: var(--text-muted, #888);
          margin-bottom: 4px;
        }

        .total-value {
          font-size: 1.25rem;
          font-weight: 600;
        }

        .total-card.income .total-value {
          color: #22c55e;
        }

        .total-card.expenses .total-value {
          color: #ef4444;
        }

        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 4px;
          background: var(--bg-card, #1a1a2e);
          border: 1px solid var(--border, #2d2d3a);
          border-radius: 12px;
          padding: 16px;
        }

        .calendar-header {
          text-align: center;
          padding: 12px;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-muted, #888);
          text-transform: uppercase;
        }

        .calendar-day {
          min-height: 80px;
          padding: 8px;
          background: var(--bg-input, #252535);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .calendar-day.empty {
          background: transparent;
          cursor: default;
        }

        .calendar-day.has-data:hover {
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid rgba(99, 102, 241, 0.3);
        }

        .calendar-day.today {
          border: 2px solid #6366f1;
        }

        .calendar-day.selected {
          background: rgba(99, 102, 241, 0.2);
          border: 1px solid #6366f1;
        }

        .day-number {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text, #e0e0e0);
          margin-bottom: 4px;
        }

        .day-summary {
          text-align: center;
        }

        .net-value {
          font-size: 0.75rem;
          font-weight: 600;
        }

        .tx-count {
          display: block;
          font-size: 0.625rem;
          color: var(--text-muted, #888);
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 20px;
        }

        .modal {
          background: var(--bg-card, #1a1a2e);
          border: 1px solid var(--border, #2d2d3a);
          border-radius: 16px;
          padding: 24px;
          width: 100%;
          max-width: 400px;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .modal-header h3 {
          margin: 0;
          font-size: 1.125rem;
          color: var(--text, #e0e0e0);
        }

        .close-btn {
          background: transparent;
          border: none;
          color: var(--text-muted, #888);
          cursor: pointer;
          padding: 4px;
        }

        .close-btn:hover {
          color: var(--text, #e0e0e0);
        }

        .day-details {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          padding: 12px;
          background: var(--bg-input, #252535);
          border-radius: 8px;
        }

        .detail-row.total {
          background: rgba(99, 102, 241, 0.1);
          font-weight: 600;
        }

        .detail-row .income {
          color: #22c55e;
        }

        .detail-row .expenses {
          color: #ef4444;
        }

        .no-data {
          text-align: center;
          color: var(--text-muted, #888);
          padding: 20px;
        }

        @media (max-width: 768px) {
          .month-totals {
            grid-template-columns: 1fr;
          }

          .calendar-day {
            min-height: 60px;
            padding: 4px;
          }

          .net-value {
            font-size: 0.625rem;
          }

          .tx-count {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
