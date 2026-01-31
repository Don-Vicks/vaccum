import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import confetti from 'canvas-confetti';
import { type FC, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useReclaimAccounts } from '../hooks/useReclaimAccounts';
import { useScanAccounts } from '../hooks/useScanAccounts';
import { formatSol, shortenPubkey } from '../utils/format';

export const Dashboard: FC = () => {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const { accounts, loading: scanning, error, totalReclaimable, scan } = useScanAccounts(connection, publicKey);
  const { reclaim, reclaiming, successCount, error: reclaimError } = useReclaimAccounts(connection);

  // Auto-scan on connect
  useEffect(() => {
    if (publicKey) {
      scan().catch(() => { });
    }
  }, [publicKey, scan]);

  useEffect(() => {
    if (error) toast.error(`Scan Error: ${error}`);
    if (reclaimError) toast.error(`Reclaim Error: ${reclaimError}`);
  }, [error, reclaimError]);

  const handleReclaim = async () => {
    const reclaimable = accounts.filter(a => a.status === 'reclaimable');
    if (reclaimable.length === 0) return;

    const toastId = toast.loading('Reclaiming rent...');
    try {
      await reclaim(reclaimable);
      toast.success('Rent reclaimed successfully!', { id: toastId });
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      await scan();
    } catch (err) {
      toast.error('Failed to reclaim rent.', { id: toastId });
    }
  };

  if (!publicKey) {
    return (
      <div className="dashboard-empty">
        <p>Connect your wallet to scan for zombie accounts.</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Stats Grid */}
      <div className="dashboard-grid">
        {/* Total Reclaimable Card */}
        <div className="dashboard-card dashboard-stats-card">
          <h3 className="dashboard-label">Total Reclaimable Rent</h3>
          <div className="dashboard-value">
            {scanning ? (
              <span style={{ color: 'var(--text-muted)' }}>Scanning...</span>
            ) : (
              <span className="dashboard-value-gradient">
                {formatSol(totalReclaimable)}
              </span>
            )}
          </div>
        </div>

        {/* Actions Card */}
        <div className="dashboard-card dashboard-actions-card">
          <button
            onClick={scan}
            disabled={scanning || reclaiming}
            className="dashboard-btn-rescan"
          >
            {scanning ? 'Scanning...' : 'Rescan Accounts'}
          </button>
          {successCount > 0 && (
            <div style={{ marginTop: '16px', color: '#22c55e', fontSize: '14px' }}>
              Successfully reclaimed {successCount} accounts!
            </div>
          )}
        </div>
      </div>

      {/* Account List */}
      <div className="dashboard-list-container">
        <div className="dashboard-list-header">
          <h2 className="dashboard-list-title">
            Detailed Accounts ({accounts.length})
          </h2>

          {totalReclaimable > 0 && !scanning && (
            <button
              onClick={handleReclaim}
              disabled={reclaiming}
              className="dashboard-btn-reclaim"
            >
              {reclaiming ? 'Reclaiming...' : `Reclaim All (${formatSol(totalReclaimable)})`}
            </button>
          )}
        </div>

        <div style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
          {scanning ? (
            <div className="dashboard-empty">
              <div style={{
                width: '48px',
                height: '48px',
                border: '4px solid rgba(34, 211, 238, 0.3)',
                borderTopColor: '#22d3ee',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px'
              }}></div>
              Scanning blockchain...
            </div>
          ) : accounts.length === 0 ? (
            <div className="dashboard-empty">
              No token accounts found.
            </div>
          ) : (
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead style={{ background: 'var(--bg-elevated)', position: 'sticky', top: 0, zIndex: 10 }}>
                <tr style={{ color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '16px', fontWeight: 500, borderBottom: '1px solid var(--border-color)' }}>Account Address</th>
                  <th style={{ padding: '16px', fontWeight: 500, borderBottom: '1px solid var(--border-color)' }}>Mint</th>
                  <th style={{ padding: '16px', fontWeight: 500, borderBottom: '1px solid var(--border-color)' }}>Status</th>
                  <th style={{ padding: '16px', fontWeight: 500, borderBottom: '1px solid var(--border-color)', textAlign: 'right' }}>Rent (SOL)</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr
                    key={account.pubkey.toBase58()}
                    style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '16px', fontFamily: 'monospace', fontSize: '14px', color: 'var(--text-primary)' }}>
                      {shortenPubkey(account.pubkey.toBase58(), 6)}
                      <a
                        href={`https://solscan.io/account/${account.pubkey.toBase58()}?cluster=devnet`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ marginLeft: '8px', color: '#22d3ee', fontSize: '12px', textDecoration: 'none' }}
                      >
                        ↗
                      </a>
                    </td>
                    <td style={{ padding: '16px', fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-muted)' }}>
                      {shortenPubkey(account.mint.toBase58(), 4)}
                    </td>
                    <td style={{ padding: '16px' }}>
                      {account.status === 'reclaimable' ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 500,
                          background: 'rgba(34, 197, 94, 0.2)',
                          color: '#86efac',
                          border: '1px solid rgba(34, 197, 94, 0.3)'
                        }}>
                          Reclaimable
                        </span>
                      ) : (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 500,
                          background: 'rgba(59, 130, 246, 0.2)',
                          color: '#93c5fd'
                        }}>
                          Active
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right', fontFamily: 'monospace', color: '#22d3ee' }}>
                      {formatSol(account.lamports)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {(error || reclaimError) && (
        <div style={{
          marginTop: '24px',
          padding: '16px',
          borderRadius: '12px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: '#f87171',
          textAlign: 'center'
        }}>
          Error: {error || reclaimError}
        </div>
      )}
    </div>
  );
};
