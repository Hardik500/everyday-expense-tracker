import { useState, useEffect } from 'react';
import { fetchWithAuth } from '../utils/api';
import { PageLoading } from '../components/ui/Loading';
import PageHeader from '../components/layout/PageHeader';

interface Goal {
  id: number;
  name: string;
  description: string | null;
  target_amount: number;
  current_amount: number;
  category_id: number | null;
  deadline: string | null;
  icon: string | null;
  color: string;
  is_active: boolean;
  category_name: string | null;
  progress_percent: number;
  days_remaining: number | null;
}

interface Props {
  apiBase: string;
}

export default function GoalsPage({ apiBase }: Props) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [contributingGoal, setContributingGoal] = useState<Goal | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchGoals();
  }, [apiBase]);

  const fetchGoals = async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth(`${apiBase}/api/v1/goals`);
      if (response.ok) {
        const data = await response.json();
        setGoals(data);
      }
    } catch (error) {
      console.error('Failed to fetch goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleContribute = async (goalId: number, amount: number) => {
    try {
      const response = await fetchWithAuth(`${apiBase}/api/v1/goals/${goalId}/contribute?amount=${amount}`, {
        method: 'POST',
      });
      if (response.ok) {
        setMessage({ type: 'success', text: 'Contribution added successfully!' });
        fetchGoals();
        setContributingGoal(null);
        setTimeout(() => setMessage(null), 3000);
      } else {
        throw new Error('Failed to contribute');
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to add contribution. Please try again.' });
    }
  };

  const handleDelete = async (goalId: number) => {
    if (!confirm('Are you sure you want to delete this goal?')) return;
    try {
      const response = await fetchWithAuth(`${apiBase}/api/v1/goals/${goalId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setGoals(prev => prev.filter(g => g.id !== goalId));
        setMessage({ type: 'success', text: 'Goal deleted successfully!' });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete goal.' });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'No deadline';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 80) return '#22c55e';
    if (percent >= 50) return '#3b82f6';
    if (percent >= 25) return '#f59e0b';
    return '#ef4444';
  };

  if (loading) return <PageLoading text="Loading goals..." />;

  return (
    <div className="goals-page">
      <PageHeader
        title="Goals Dashboard"
        description="Track your savings progress"
        action={
          <button className="btn-add" onClick={() => setShowForm(true)}>
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Goal
          </button>
        }
      />

      {message && (
        <div className={`message-box ${message.type}`}>
          {message.text}
        </div>
      )}

      {goals.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎯</div>
          <h3>No Goals Yet</h3>
          <p>Start saving for something special!</p>
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            Create Your First Goal
          </button>
        </div>
      ) : (
        <div className="goals-grid">
          {goals.map((goal) => (
            <div key={goal.id} className="goal-card">
              <div className="goal-header">
                <span className="goal-icon">{goal.icon || '🎯'}</span>
                <div className="goal-info">
                  <h3>{goal.name}</h3>
                  {goal.description && <p className="goal-description">{goal.description}</p>}
                </div>
                <button className="btn-delete-icon" onClick={() => handleDelete(goal.id)}>
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              <div className="goal-amounts">
                <span className="current">{formatCurrency(goal.current_amount)}</span>
                <span className="separator">/</span>
                <span className="target">{formatCurrency(goal.target_amount)}</span>
              </div>

              <div className="progress-container">
                <div className="progress-bar-bg">
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${Math.min(goal.progress_percent, 100)}%`,
                      backgroundColor: goal.color || getProgressColor(goal.progress_percent),
                    }}
                  />
                </div>
                <span className="progress-percent">{goal.progress_percent.toFixed(0)}%</span>
              </div>

              <div className="goal-meta">
                <div className="meta-item">
                  <span className="meta-label">Deadline</span>
                  <span className="meta-value">{formatDate(goal.deadline)}</span>
                </div>
                {goal.days_remaining !== null && (
                  <div className="meta-item">
                    <span className="meta-label">Days Left</span>
                    <span className="meta-value days-left">{goal.days_remaining}</span>
                  </div>
                )}
                {goal.category_name && (
                  <div className="meta-item">
                    <span className="meta-label">Category</span>
                    <span className="meta-value">{goal.category_name}</span>
                  </div>
                )}
              </div>

              <button
                className="btn-contribute"
                onClick={() => setContributingGoal(goal)}
              >
                Add Contribution
              </button>

              {/* Contribution Modal */}
              {contributingGoal?.id === goal.id && (
                <div className="modal-overlay" onClick={() => setContributingGoal(null)}>
                  <div className="modal" onClick={(e) => e.stopPropagation()}>
                    <h3>Add to {goal.name}</h3>
                    <ContributionForm
                      goal={goal}
                      onSubmit={(amount) => handleContribute(goal.id, amount)}
                      onCancel={() => setContributingGoal(null)}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Goal Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create New Goal</h3>
            <GoalForm
              apiBase={apiBase}
              onSuccess={(newGoal) => {
                setGoals(prev => [...prev, newGoal]);
                setShowForm(false);
                setMessage({ type: 'success', text: 'Goal created successfully!' });
                setTimeout(() => setMessage(null), 3000);
              }}
              onCancel={() => setShowForm(false)}
            />
          </div>
        </div>
      )}

      <style>{`
        .goals-page {
          max-width: 1200px;
          display: grid;
          gap: 1.5rem;
        }

        .btn-add {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-add:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
        }

        .message-box {
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 0.9375rem;
        }

        .message-box.success {
          background: rgba(34, 197, 94, 0.1);
          color: #22c55e;
          border: 1px solid rgba(34, 197, 94, 0.3);
        }

        .message-box.error {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .empty-state {
          text-align: center;
          padding: 80px 20px;
          background: var(--bg-card, #1a1a2e);
          border: 1px solid var(--border, #2d2d3a);
          border-radius: 16px;
        }

        .empty-icon {
          font-size: 4rem;
          margin-bottom: 16px;
        }

        .empty-state h3 {
          margin: 0 0 8px 0;
          color: var(--text, #e0e0e0);
        }

        .empty-state p {
          color: var(--text-muted, #888);
          margin: 0 0 24px 0;
        }

        .btn-primary {
          padding: 12px 24px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
        }

        .goals-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 20px;
        }

        .goal-card {
          background: var(--bg-card, #1a1a2e);
          border: 1px solid var(--border, #2d2d3a);
          border-radius: 16px;
          padding: 24px;
          position: relative;
        }

        .goal-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 16px;
        }

        .goal-icon {
          font-size: 2rem;
          line-height: 1;
        }

        .goal-info {
          flex: 1;
        }

        .goal-info h3 {
          margin: 0 0 4px 0;
          font-size: 1.25rem;
          color: var(--text, #e0e0e0);
        }

        .goal-description {
          margin: 0;
          font-size: 0.875rem;
          color: var(--text-muted, #888);
        }

        .btn-delete-icon {
          background: transparent;
          border: none;
          color: var(--text-muted, #888);
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: all 0.15s;
        }

        .btn-delete-icon:hover {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }

        .goal-amounts {
          display: flex;
          align-items: baseline;
          gap: 8px;
          margin-bottom: 12px;
        }

        .goal-amounts .current {
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--text, #e0e0e0);
        }

        .goal-amounts .separator {
          color: var(--text-muted, #888);
        }

        .goal-amounts .target {
          font-size: 1rem;
          color: var(--text-muted, #888);
        }

        .progress-container {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .progress-bar-bg {
          flex: 1;
          height: 8px;
          background: var(--bg-input, #252535);
          border-radius: 4px;
          overflow: hidden;
        }

        .progress-bar-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        .progress-percent {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text, #e0e0e0);
          min-width: 40px;
        }

        .goal-meta {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 20px;
          padding: 12px;
          background: var(--bg-input, #252535);
          border-radius: 8px;
        }

        .meta-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .meta-label {
          font-size: 0.75rem;
          color: var(--text-muted, #888);
        }

        .meta-value {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text, #e0e0e0);
        }

        .meta-value.days-left {
          color: #f59e0b;
        }

        .btn-contribute {
          width: 100%;
          padding: 12px;
          background: rgba(99, 102, 241, 0.1);
          color: #6366f1;
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }

        .btn-contribute:hover {
          background: rgba(99, 102, 241, 0.2);
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

        .modal h3 {
          margin: 0 0 20px 0;
          color: var(--text, #e0e0e0);
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-group label {
          display: block;
          margin-bottom: 6px;
          font-size: 0.875rem;
          color: var(--text-muted, #888);
        }

        .form-group input,
        .form-group select {
          width: 100%;
          padding: 10px 12px;
          background: var(--bg-input, #252535);
          border: 1px solid var(--border, #2d2d3a);
          border-radius: 8px;
          color: var(--text, #e0e0e0);
          font-size: 1rem;
        }

        .form-group input:focus,
        .form-group select:focus {
          outline: none;
          border-color: #6366f1;
        }

        .form-actions {
          display: flex;
          gap: 12px;
          margin-top: 24px;
        }

        .form-actions button {
          flex: 1;
          padding: 12px;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }

        .btn-submit {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white;
          border: none;
        }

        .btn-submit:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
        }

        .btn-cancel {
          background: transparent;
          color: var(--text-muted, #888);
          border: 1px solid var(--border, #2d2d3a);
        }

        .btn-cancel:hover {
          background: var(--bg-input, #252535);
        }

        @media (max-width: 640px) {
          .goals-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

function ContributionForm({
  goal,
  onSubmit,
  onCancel,
}: {
  goal: Goal;
  onSubmit: (amount: number) => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount);
    if (value > 0) {
      setLoading(true);
      onSubmit(value);
    }
  };

  const remaining = goal.target_amount - goal.current_amount;

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label>Amount (₹)</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Enter amount"
          min="1"
          step="1"
          autoFocus
        />
        <div style={{ marginTop: 8, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Remaining: ₹{remaining.toLocaleString()}
        </div>
      </div>
      <div className="form-actions">
        <button type="button" className="btn-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-submit" disabled={loading || !amount}>
          {loading ? 'Adding...' : 'Add'}
        </button>
      </div>
    </form>
  );
}

function GoalForm({
  apiBase,
  onSuccess,
  onCancel,
}: {
  apiBase: string;
  onSuccess: (goal: Goal) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [icon, setIcon] = useState('🎯');
  const [color, setColor] = useState('#6366f1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const icons = ['🎯', '🏦', '💰', '🏠', '🚗', '💻', '✈️', '🎓', '💍', '🎁', '🏋️', '📱'];
  const colors = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!name || !targetAmount) {
      setError('Name and target amount are required');
      return;
    }

    setLoading(true);
    try {
      const response = await fetchWithAuth(`${apiBase}/api/v1/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || null,
          target_amount: parseFloat(targetAmount),
          deadline: deadline || null,
          icon,
          color,
        }),
      });

      if (response.ok) {
        const newGoal = await response.json();
        onSuccess(newGoal);
      } else {
        throw new Error('Failed to create goal');
      }
    } catch (err) {
      setError('Failed to create goal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="form-error">{error}</div>}
      
      <div className="form-group">
        <label>Goal Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Emergency Fund"
          autoFocus
        />
      </div>

      <div className="form-group">
        <label>Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
        />
      </div>

      <div className="form-group">
        <label>Target Amount (₹) *</label>
        <input
          type="number"
          value={targetAmount}
          onChange={(e) => setTargetAmount(e.target.value)}
          placeholder="100000"
          min="1"
        />
      </div>

      <div className="form-group">
        <label>Deadline</label>
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label>Icon</label>
        <div className="icon-picker">
          {icons.map((i) => (
            <button
              key={i}
              type="button"
              className={`icon-option ${icon === i ? 'selected' : ''}`}
              onClick={() => setIcon(i)}
            >
              {i}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>Color</label>
        <div className="color-picker">
          {colors.map((c) => (
            <button
              key={c}
              type="button"
              className={`color-option ${color === c ? 'selected' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      </div>

      <div className="form-actions">
        <button type="button" className="btn-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create Goal'}
        </button>
      </div>

      <style>{`
        .form-error {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          padding: 10px;
          border-radius: 8px;
          margin-bottom: 16px;
          font-size: 0.875rem;
        }

        .icon-picker, .color-picker {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .icon-option {
          width: 40px;
          height: 40px;
          font-size: 1.25rem;
          background: var(--bg-input, #252535);
          border: 2px solid var(--border, #2d2d3a);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .icon-option:hover {
          border-color: #6366f1;
        }

        .icon-option.selected {
          border-color: #6366f1;
          background: rgba(99, 102, 241, 0.2);
        }

        .color-option {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 3px solid transparent;
          cursor: pointer;
          transition: all 0.15s;
        }

        .color-option:hover {
          transform: scale(1.1);
        }

        .color-option.selected {
          border-color: white;
          box-shadow: 0 0 0 2px var(--bg-card, #1a1a2e);
        }
      `}</style>
    </form>
  );
}
