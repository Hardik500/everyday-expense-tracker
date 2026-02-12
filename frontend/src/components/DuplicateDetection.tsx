import { useState, useEffect } from 'react';
import { fetchWithAuth } from '../utils/api';
import { PageLoading, InlineLoading } from './ui/Loading';

interface DuplicateTransaction {
  id: number;
  original_transaction_id: number;
  duplicate_transaction_id: number;
  similarity_score: number;
  status: string;
  original_amount: number;
  original_description: string;
  original_date: string;
  duplicate_amount: number;
  duplicate_description: string;
  duplicate_date: string;
}

interface Props {
  apiBase: string;
  onRefresh?: () => void;
}

export function DuplicateDetection({ apiBase, onRefresh }: Props) {
  const [duplicates, setDuplicates] = useState<DuplicateTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [days, setDays] = useState(90);
  const [similarity, setSimilarity] = useState(85);

  const fetchDuplicates = async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth(
        `${apiBase}/api/v1/duplicates/detect?days=${days}&similarity_threshold=${similarity / 100}`
      );
      if (response.ok) {
        const data = await response.json();
        setDuplicates(data);
      }
    } catch (error) {
      console.error('Failed to fetch duplicates:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDuplicates();
  }, [apiBase]);

  const handleScan = async () => {
    setScanning(true);
    await fetchDuplicates();
    setScanning(false);
  };

  const handleAction = async (dup: DuplicateTransaction, action: 'mark_duplicate' | 'not_duplicate' | 'delete_duplicate') => {
    setActionLoading(dup.id);
    try {
      const response = await fetchWithAuth(`${apiBase}/api/v1/duplicates/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pair_id: dup.id, action }),
      });

      if (response.ok) {
        setMessage({
          type: 'success',
          text: action === 'delete_duplicate' 
            ? 'Duplicate transaction deleted successfully'
            : `Marked as ${action === 'mark_duplicate' ? 'duplicate' : 'not duplicate'}`
        });
        setDuplicates(prev => prev.filter(d => d.id !== dup.id && d.duplicate_transaction_id !== dup.duplicate_transaction_id));
        onRefresh?.();
        setTimeout(() => setMessage(null), 3000);
      } else {
        throw new Error('Action failed');
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to process duplicate. Please try again.' });
    } finally {
      setActionLoading(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(Math.abs(amount));
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  if (loading) return <div className="card"><PageLoading text="Scanning for duplicates..." /></div>;

  return (
    <div className="duplicate-detection">
      <div className="card">
        <div className="card-header">
          <h2>🔍 Duplicate Detection</h2>
          <p className="subtitle">Find and manage potential duplicate transactions</p>
        </div>

        {/* Scan Settings */}
        <div className="scan-settings">
          <div className="setting-row">
            <label>
              <span>Scan Period</span>
              <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
                <option value={180}>Last 6 months</option>
                <option value={365}>Last year</option>
              </select>
            </label>
            <label>
              <span>Similarity Threshold</span>
              <select value={similarity} onChange={(e) => setSimilarity(Number(e.target.value))}>
                <option value={90}>90% (Exact match)</option>
                <option value={85}>85% (High similarity)</option>
                <option value={75}>75% (Medium similarity)</option>
              </select>
            </label>
            <button onClick={handleScan} disabled={scanning} className="btn-scan">
              {scanning ? <InlineLoading /> : (
                <>
                  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Scan Now
                </>
              )}
            </button>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`message-box ${message.type}`}>
            {message.text}
          </div>
        )}

        {/* Results */}
        {duplicates.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✨</div>
            <h3>No Duplicates Found</h3>
            <p>Great! No potential duplicates were detected in the selected period.</p>
          </div>
        ) : (
          <div className="duplicates-list">
            <div className="results-header">
              <span className="badge">{duplicates.length} potential duplicates found</span>
            </div>

            {duplicates.map((dup) => (
              <div key={dup.id} className="duplicate-card">
                {/* Similarity Score */}
                <div className="similarity-badge" style={{ 
                  background: dup.similarity_score >= 0.95 ? '#ef4444' : 
                             dup.similarity_score >= 0.9 ? '#f59e0b' : '#3b82f6'
                }}>
                  {(dup.similarity_score * 100).toFixed(0)}% Match
                </div>

                {/* Transaction Comparison */}
                <div className="transactions-comparison">
                  {/* Original */}
                  <div className="transaction original">
                    <div className="tx-header">
                      <span className="tx-label">Original</span>
                      <span className="tx-date">{formatDate(dup.original_date)}</span>
                    </div>
                    <div className="tx-amount">{formatCurrency(dup.original_amount)}</div>
                    <div className="tx-description">{dup.original_description}</div>
                  </div>

                  <div className="vs-divider">vs</div>

                  {/* Duplicate */}
                  <div className="transaction duplicate">
                    <div className="tx-header">
                      <span className="tx-label">Duplicate</span>
                      <span className="tx-date">{formatDate(dup.duplicate_date)}</span>
                    </div>
                    <div className="tx-amount">{formatCurrency(dup.duplicate_amount)}</div>
                    <div className="tx-description">{dup.duplicate_description}</div>
                  </div>
                </div>

                {/* Actions */}
                <div className="duplicate-actions">
                  <button
                    onClick={() => handleAction(dup, 'delete_duplicate')}
                    disabled={actionLoading === dup.id}
                    className="btn-delete"
                  >
                    {actionLoading === dup.id ? 'Processing...' : 'Delete Duplicate'}
                  </button>
                  <button
                    onClick={() => handleAction(dup, 'mark_duplicate')}
                    disabled={actionLoading === dup.id}
                    className="btn-confirm"
                  >
                    Mark as Duplicate
                  </button>
                  <button
                    onClick={() => handleAction(dup, 'not_duplicate')}
                    disabled={actionLoading === dup.id}
                    className="btn-reject"
                  >
                    Not a Duplicate
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .duplicate-detection {
          max-width: 900px;
        }

        .card {
          background: var(--bg-card, #1a1a2e);
          border: 1px solid var(--border, #2d2d3a);
          border-radius: 16px;
          padding: 24px;
        }

        .card-header {
          margin-bottom: 24px;
        }

        .card-header h2 {
          margin: 0 0 8px 0;
          font-size: 1.25rem;
          color: var(--text, #e0e0e0);
        }

        .subtitle {
          color: var(--text-muted, #888);
          font-size: 0.875rem;
          margin: 0;
        }

        .scan-settings {
          background: rgba(99, 102, 241, 0.05);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 20px;
        }

        .setting-row {
          display: flex;
          gap: 16px;
          align-items: flex-end;
          flex-wrap: wrap;
        }

        .setting-row label {
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 1;
          min-width: 150px;
        }

        .setting-row span {
          font-size: 0.8125rem;
          color: var(--text-muted, #888);
          font-weight: 500;
        }

        .setting-row select {
          padding: 10px 12px;
          background: var(--bg-input, #252535);
          border: 1px solid var(--border, #2d2d3a);
          border-radius: 8px;
          color: var(--text, #e0e0e0);
          font-size: 0.9375rem;
          cursor: pointer;
        }

        .btn-scan {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-scan:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
        }

        .message-box {
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 16px;
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

        .message-box.info {
          background: rgba(59, 130, 246, 0.1);
          color: #3b82f6;
          border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
        }

        .empty-icon {
          font-size: 4rem;
          margin-bottom: 16px;
        }

        .empty-state h3 {
          margin: 0 0 8px 0;
          color: var(--text, #e0e0e0);
          font-size: 1.25rem;
        }

        .empty-state p {
          color: var(--text-muted, #888);
          margin: 0;
        }

        .results-header {
          margin-bottom: 16px;
        }

        .badge {
          display: inline-flex;
          padding: 6px 12px;
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
          border-radius: 20px;
          font-size: 0.8125rem;
          font-weight: 500;
        }

        .duplicates-list {
          display: grid;
          gap: 16px;
        }

        .duplicate-card {
          background: var(--bg-input, #252535);
          border: 1px solid var(--border, #2d2d3a);
          border-radius: 12px;
          padding: 20px;
          position: relative;
        }

        .similarity-badge {
          position: absolute;
          top: -10px;
          right: 20px;
          padding: 4px 12px;
          border-radius: 20px;
          color: white;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .transactions-comparison {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: 16px;
          align-items: center;
          margin-bottom: 16px;
        }

        .transaction {
          background: var(--bg-card, #1a1a2e);
          border-radius: 8px;
          padding: 16px;
        }

        .tx-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .tx-label {
          font-size: 0.75rem;
          font-weight: 600;
          padding: 4px 8px;
          border-radius: 4px;
          background: rgba(99, 102, 241, 0.15);
          color: #6366f1;
        }

        .transaction.duplicate .tx-label {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
        }

        .tx-date {
          font-size: 0.75rem;
          color: var(--text-muted, #888);
        }

        .tx-amount {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--text, #e0e0e0);
          margin-bottom: 4px;
        }

        .tx-description {
          font-size: 0.875rem;
          color: var(--text-secondary, #a0a0a0);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .vs-divider {
          font-size: 0.75rem;
          color: var(--text-muted, #888);
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .duplicate-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .duplicate-actions button {
          padding: 10px 16px;
          border-radius: 8px;
          font-weight: 500;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.15s;
          border: none;
        }

        .duplicate-actions button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-delete {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.3) !important;
        }

        .btn-delete:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.2);
        }

        .btn-confirm {
          background: rgba(245, 158, 11, 0.1);
          color: #f59e0b;
          border: 1px solid rgba(245, 158, 11, 0.3) !important;
        }

        .btn-confirm:hover:not(:disabled) {
          background: rgba(245, 158, 11, 0.2);
        }

        .btn-reject {
          background: transparent;
          color: var(--text-muted, #888);
          border: 1px solid var(--border, #2d2d3a) !important;
          margin-left: auto;
        }

        .btn-reject:hover:not(:disabled) {
          background: rgba(99, 102, 241, 0.1);
          color: #6366f1;
          border-color: rgba(99, 102, 241, 0.3) !important;
        }

        @media (max-width: 640px) {
          .transactions-comparison {
            grid-template-columns: 1fr;
          }

          .vs-divider {
            text-align: center;
            padding: 8px;
          }

          .duplicate-actions {
            flex-direction: column;
          }

          .duplicate-actions button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

export default DuplicateDetection;