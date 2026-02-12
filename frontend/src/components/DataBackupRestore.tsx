import { useState, useRef } from 'react';
import { fetchWithAuth } from '../utils/api';

interface BackupRestoreProps {
  apiBase: string;
  onBackupComplete?: () => void;
  onRestoreComplete?: () => void;
}

// Encryption utility using Web Crypto API
const cryptoUtils = {
  // Generate a key from password using PBKDF2
  async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password);
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordData,
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  },

  // Encrypt data
  async encrypt(data: object, password: string): Promise<{ encrypted: string; salt: string; iv: string }> {
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(JSON.stringify(data));
    
    // Generate random salt and IV
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const key = await this.deriveKey(password, salt);
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      dataBytes
    );
    
    return {
      encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
      salt: btoa(String.fromCharCode(...salt)),
      iv: btoa(String.fromCharCode(...iv))
    };
  },

  // Decrypt data
  async decrypt(encryptedData: { encrypted: string; salt: string; iv: string }, password: string): Promise<object> {
    const salt = Uint8Array.from(atob(encryptedData.salt), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(encryptedData.iv), c => c.charCodeAt(0));
    const encrypted = Uint8Array.from(atob(encryptedData.encrypted), c => c.charCodeAt(0));
    
    const key = await this.deriveKey(password, salt);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encrypted
    );
    
    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decrypted));
  }
};

export function DataBackupRestore({ apiBase, onBackupComplete, onRestoreComplete }: BackupRestoreProps) {
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [modalMode, setModalMode] = useState<'backup' | 'restore' | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [backupData, setBackupData] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBackup = async () => {
    setBackupLoading(true);
    setMessage(null);

    try {
      const response = await fetchWithAuth(`${apiBase}/backup`);
      
      if (!response.ok) {
        throw new Error('Backup failed');
      }

      const data = await response.json();
      
      // Store the data and show password modal
      setBackupData(data);
      setModalMode('backup');
      setShowPasswordModal(true);
      onBackupComplete?.();
    } catch (error) {
      setMessage({ type: 'error', text: 'Backup failed. Please try again.' });
    } finally {
      setBackupLoading(false);
    }
  };

  const handleEncryptAndDownload = async () => {
    if (!password || password.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    try {
      const encrypted = await cryptoUtils.encrypt(backupData, password);
      
      // Create and download the encrypted backup file
      const backupPackage = {
        version: '2.0',
        encrypted: true,
        exportedAt: new Date().toISOString(),
        ...encrypted
      };
      
      const blob = new Blob([JSON.stringify(backupPackage, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `expense-tracker-backup-${new Date().toISOString().split('T')[0]}.encrypted.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setMessage({ type: 'success', text: 'Encrypted backup downloaded successfully!' });
      closePasswordModal();
      
      // Clear message after 5 seconds
      setTimeout(() => setMessage(null), 5000);
    } catch (error) {
      setPasswordError('Encryption failed. Please try again.');
    }
  };

  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreFile(file);
    setPassword('');
    setPasswordError('');
    setModalMode('restore');
    setShowPasswordModal(true);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDecryptAndRestore = async () => {
    if (!password) {
      setPasswordError('Please enter your password');
      return;
    }
    if (!restoreFile) {
      setPasswordError('No file selected');
      return;
    }

    setRestoreLoading(true);
    setPasswordError('');

    try {
      const fileContent = await restoreFile.text();
      const backupPackage = JSON.parse(fileContent);

      // Check if encrypted or legacy format
      let backupData: any;
      
      if (backupPackage.encrypted) {
        // Decrypt the data
        try {
          backupData = await cryptoUtils.decrypt(
            { encrypted: backupPackage.encrypted, salt: backupPackage.salt, iv: backupPackage.iv },
            password
          );
        } catch (e) {
          throw new Error('Incorrect password or corrupted file');
        }
      } else {
        // Legacy unencrypted backup
        backupData = backupPackage;
      }

      // Validate backup format
      if (!backupData.transactions || !backupData.categories) {
        throw new Error('Invalid backup file format');
      }

      const response = await fetchWithAuth(`${apiBase}/restore`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(backupData),
      });

      if (!response.ok) {
        throw new Error('Restore failed');
      }

      const result = await response.json();
      
      setMessage({ 
        type: 'success', 
        text: `Restore complete! Restored ${result.restored.transactions} transactions, ${result.restored.categories} categories, and ${result.restored.accounts} accounts.` 
      });
      closePasswordModal();
      onRestoreComplete?.();
    } catch (error: any) {
      setPasswordError(error.message || 'Restore failed. Please check your backup file and password.');
    } finally {
      setRestoreLoading(false);
    }
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setShowPassword(false);
    setModalMode(null);
    setRestoreFile(null);
    setBackupData(null);
  };

  const passwordStrength = () => {
    if (!password) return { text: '', color: '' };
    if (password.length < 8) return { text: 'Too short', color: '#ef4444' };
    if (password.length < 12) return { text: 'Weak', color: '#f59e0b' };
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    const strength = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
    
    if (strength >= 4) return { text: 'Strong', color: '#10b981' };
    if (strength >= 3) return { text: 'Good', color: '#3b82f6' };
    return { text: 'Fair', color: '#f59e0b' };
  };

  const strength = passwordStrength();

  return (
    <div className="backup-restore-card">
      <div className="backup-restore-header">
        <h2>Data Backup & Restore</h2>
        <p className="subtitle">Secure your data with encrypted backups</p>
      </div>

      <div style={{ display: 'grid', gap: '1.5rem' }}>
        {/* Backup Section */}
        <div className="backup-section">
          <div className="section-row">
            <div className="icon-container backup-icon">
              <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            </div>
            <div className="section-info">
              <div className="section-title">Backup Data</div>
              <div className="section-description">
                Download all your transactions, categories, and accounts with encryption
              </div>
            </div>
          </div>

          <button
            onClick={handleBackup}
            disabled={backupLoading}
            className={backupLoading ? 'btn-secondary' : 'btn-primary'}
          >
            {backupLoading ? (
              <>
                <span className="spinner spinner-sm" />
                <span>Creating backup...</span>
              </>
            ) : (
              <>
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span>Create Encrypted Backup</span>
              </>
            )}
          </button>
        </div>

        {/* Restore Section */}
        <div className="restore-section">
          <div className="section-row">
            <div className="icon-container restore-icon">
              <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
            </div>
            <div className="section-info">
              <div className="section-title">Restore Data</div>
              <div className="section-description">
                Upload a backup file to restore your data (replaces current data)
              </div>
            </div>
          </div>

          <div className="warning-box">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Restoring will replace your current data. Make sure to backup first!</span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          <button
            onClick={handleRestoreClick}
            disabled={restoreLoading}
            className="btn-restore"
          >
            {restoreLoading ? (
              <>
                <span className="spinner spinner-sm" />
                <span>Restoring...</span>
              </>
            ) : (
              <>
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                <span>Upload Backup File</span>
              </>
            )}
          </button>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`message-box ${message.type}`}>
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {message.type === 'success' ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              )}
            </svg>
            <span>{message.text}</span>
          </div>
        )}
      </div>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closePasswordModal()}>
          <div className="password-modal">
            <div className="modal-header">
              <h3>{modalMode === 'backup' ? '🔐 Encrypt Backup' : '🔓 Decrypt Backup'}</h3>
              <button className="close-btn" onClick={closePasswordModal}>×</button>
            </div>
            
            <div className="modal-content">
              {modalMode === 'backup' ? (
                <>
                  <p className="modal-description">
                    Enter a strong password to encrypt your backup. You'll need this password to restore your data.
                  </p>
                  
                  <div className="form-group">
                    <label>Password</label>
                    <div className="password-input-wrapper">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password (min 8 characters)"
                        autoFocus
                      />
                      <button 
                        className="toggle-visibility"
                        onClick={() => setShowPassword(!showPassword)}
                        type="button"
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    {password && (
                      <div className="password-strength" style={{ color: strength.color }}>
                        Strength: {strength.text}
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Confirm Password</label>
                    <div className="password-input-wrapper">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm password"
                      />
                    </div>
                  </div>

                  <div className="password-tips">
                    <strong>💡 Tips for a strong password:</strong>
                    <ul>
                      <li>At least 12 characters recommended</li>
                      <li>Mix uppercase, lowercase, numbers, and symbols</li>
                      <li>Store this password securely - it cannot be recovered!</li>
                    </ul>
                  </div>
                </>
              ) : (
                <>
                  <p className="modal-description">
                    Enter the password you used to encrypt this backup.
                  </p>
                  
                  <div className="form-group">
                    <label>Password</label>
                    <div className="password-input-wrapper">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter backup password"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleDecryptAndRestore()}
                      />
                      <button 
                        className="toggle-visibility"
                        onClick={() => setShowPassword(!showPassword)}
                        type="button"
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>

                  <div className="file-info">
                    <strong>File:</strong> {restoreFile?.name}
                  </div>
                </>
              )}
              
              {passwordError && (
                <div className="password-error">
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {passwordError}
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <button className="btn-secondary" onClick={closePasswordModal}>
                Cancel
              </button>
              <button 
                className="btn-primary"
                onClick={modalMode === 'backup' ? handleEncryptAndDownload : handleDecryptAndRestore}
                disabled={restoreLoading}
              >
                {restoreLoading ? (
                  <>
                    <span className="spinner spinner-sm" />
                    <span>Processing...</span>
                  </>
                ) : modalMode === 'backup' ? (
                  'Download Encrypted File'
                ) : (
                  'Restore Data'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .backup-restore-card {
          background: var(--bg-card, #1a1a2e);
          border: 1px solid var(--border, #2d2d3a);
          border-radius: 16px;
          padding: 24px;
        }
        
        .backup-restore-header {
          margin-bottom: 24px;
        }
        
        .backup-restore-header h2 {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0 0 4px 0;
          color: var(--text, #e0e0e0);
        }
        
        .subtitle {
          font-size: 0.875rem;
          color: var(--text-muted, #888);
          margin: 0;
        }
        
        .backup-section,
        .restore-section {
          padding: 20px;
          border-radius: 12px;
          border: 1px solid var(--border, #2d2d3a);
        }
        
        .backup-section {
          background: rgba(16, 185, 129, 0.05);
        }
        
        .restore-section {
          background: rgba(59, 130, 246, 0.05);
        }
        
        .section-row {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 16px;
        }
        
        .icon-container {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        
        .backup-icon {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
        }
        
        .restore-icon {
          background: rgba(59, 130, 246, 0.15);
          color: #3b82f6;
        }
        
        .section-info {
          flex: 1;
        }
        
        .section-title {
          font-weight: 600;
          font-size: 1rem;
          color: var(--text, #e0e0e0);
          margin-bottom: 4px;
        }
        
        .section-description {
          font-size: 0.8125rem;
          color: var(--text-muted, #888);
          line-height: 1.4;
        }
        
        .warning-box {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px 14px;
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: 8px;
          margin-bottom: 16px;
          color: #f59e0b;
          font-size: 0.875rem;
        }
        
        .warning-box svg {
          flex-shrink: 0;
          margin-top: 1px;
        }
        
        .btn-primary,
        .btn-secondary,
        .btn-restore {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          border-radius: 10px;
          font-weight: 500;
          font-size: 0.9375rem;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
        }
        
        .btn-primary {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white;
        }
        
        .btn-primary:hover:not(:disabled) {
          background: linear-gradient(135deg, #5558e3, #7c4fe6);
          transform: translateY(-1px);
        }
        
        .btn-secondary {
          background: var(--bg-input, #252535);
          color: var(--text, #e0e0e0);
          border: 1px solid var(--border, #2d2d3a);
        }
        
        .btn-secondary:hover:not(:disabled) {
          background: var(--bg-card, #1a1a2e);
          border-color: var(--accent, #6366f1);
        }
        
        .btn-restore {
          background: rgba(59, 130, 246, 0.1);
          color: #3b82f6;
          border: 1px solid rgba(59, 130, 246, 0.3);
        }
        
        .btn-restore:hover:not(:disabled) {
          background: rgba(59, 130, 246, 0.2);
        }
        
        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none !important;
        }
        
        .message-box {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 16px;
          border-radius: 10px;
          font-size: 0.9375rem;
          font-weight: 500;
        }
        
        .message-box.success {
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #10b981;
        }
        
        .message-box.error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #ef4444;
        }
        
        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
          animation: fadeIn 0.2s ease;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .password-modal {
          background: var(--bg-card, #1a1a2e);
          border: 1px solid var(--border, #2d2d3a);
          border-radius: 16px;
          width: 100%;
          max-width: 440px;
          max-height: calc(100vh - 40px);
          overflow: hidden;
          animation: slideUp 0.3s ease;
        }
        
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid var(--border, #2d2d3a);
        }
        
        .modal-header h3 {
          margin: 0;
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--text, #e0e0e0);
        }
        
        .close-btn {
          background: none;
          border: none;
          color: var(--text-muted, #888);
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          transition: all 0.2s;
        }
        
        .close-btn:hover {
          background: var(--bg-input, #252535);
          color: var(--text, #e0e0e0);
        }
        
        .modal-content {
          padding: 24px;
        }
        
        .modal-description {
          font-size: 0.875rem;
          color: var(--text-muted, #888);
          margin: 0 0 20px 0;
          line-height: 1.5;
        }
        
        .form-group {
          margin-bottom: 20px;
        }
        
        .form-group label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text, #e0e0e0);
          margin-bottom: 8px;
        }
        
        .password-input-wrapper {
          display: flex;
          gap: 8px;
        }
        
        .password-input-wrapper input {
          flex: 1;
          padding: 12px 14px;
          background: var(--bg-input, #252535);
          border: 1px solid var(--border, #2d2d3a);
          border-radius: 10px;
          color: var(--text, #e0e0e0);
          font-size: 0.9375rem;
          outline: none;
          transition: all 0.2s;
        }
        
        .password-input-wrapper input:focus {
          border-color: var(--accent, #6366f1);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
        }
        
        .toggle-visibility {
          padding: 0 16px;
          background: var(--bg-input, #252535);
          border: 1px solid var(--border, #2d2d3a);
          border-radius: 10px;
          color: var(--text-muted, #888);
          font-size: 0.8125rem;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s;
        }
        
        .toggle-visibility:hover {
          border-color: var(--accent, #6366f1);
          color: var(--text, #e0e0e0);
        }
        
        .password-strength {
          font-size: 0.8125rem;
          margin-top: 6px;
          font-weight: 500;
        }
        
        .password-tips {
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 10px;
          padding: 16px;
          font-size: 0.8125rem;
          color: var(--text-muted, #888);
        }
        
        .password-tips strong {
          color: var(--text, #e0e0e0);
        }
        
        .password-tips ul {
          margin: 8px 0 0 0;
          padding-left: 18px;
        }
        
        .password-tips li {
          margin-bottom: 4px;
        }
        
        .file-info {
          padding: 12px 14px;
          background: var(--bg-input, #252535);
          border-radius: 8px;
          font-size: 0.875rem;
          color: var(--text, #e0e0e0);
        }
        
        .password-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 14px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 10px;
          color: #ef4444;
          font-size: 0.875rem;
          margin-top: 16px;
        }
        
        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 24px 24px;
          border-top: 1px solid var(--border, #2d2d3a);
        }
        
        .modal-footer .btn-primary,
        .modal-footer .btn-secondary {
          padding: 10px 20px;
          font-size: 0.9375rem;
        }
        
        .spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid currentColor;
          border-right-color: transparent;
          border-radius: 50%;
          animation: spin 0.75s linear infinite;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .spinner-sm {
          width: 14px;
          height: 14px;
          border-width: 1.5px;
        }
        
        @media (max-width: 480px) {
          .backup-restore-card {
            padding: 16px;
          }
          
          .section-row {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .password-modal {
            max-height: 100vh;
            border-radius: 0;
          }
        }
      `}</style>
    </div>
  );
}

export default DataBackupRestore;
