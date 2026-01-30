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
    } else {
      // Optional: redirect or just show empty state
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
      <div className="text-center mt-12 animate-fade-in">
        <div className="p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-lg inline-block">
          <p className="text-slate-400 mb-4">Connect your wallet to scan for zombie accounts.</p>
        </div>
      </div>
    );
  }

  return (
  return (
    <div className="dashboard-container animate-fade-in text-left">
      {/* Stats Card */}
      <div className="dashboard-grid">
        <div className="dashboard-card dashboard-stats-card group">
          <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"></div>
          <h3 className="dashboard-label">Total Reclaimable Rent</h3>
          <div className="dashboard-value">
            {scanning ? (
              <span className="animate-pulse text-[var(--text-muted)]">Scanning...</span>
            ) : (
              <span className="dashboard-value-gradient">
                {formatSol(totalReclaimable)}
              </span>
            )}
          </div>
        </div>

        <div className="dashboard-card dashboard-actions-card">
          <button
            onClick={scan}
            disabled={scanning || reclaiming}
            className="dashboard-btn-rescan"
          >
            {scanning ? 'Scanning...' : 'Rescan Accounts'}
          </button>
          
          {successCount > 0 && (
            <div className="mt-4 text-green-400 text-sm animate-bounce font-medium">
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

        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          {scanning ? (
            <div className="dashboard-empty flex flex-col items-center">
              <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mb-4"></div>
              Scanning blockchain...
            </div>
          ) : accounts.length === 0 ? (
            <div className="dashboard-empty">
              No token accounts found.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-[var(--bg-elevated)] z-10 shadow-sm">
                <tr className="text-[var(--text-muted)] text-sm uppercase tracking-wider">
                  <th className="p-6 font-medium border-b border-[var(--border-color)]">Account Address</th>
                  <th className="p-6 font-medium border-b border-[var(--border-color)]">Mint</th>
                  <th className="p-6 font-medium border-b border-[var(--border-color)]">Status</th>
                  <th className="p-6 font-medium text-right border-b border-[var(--border-color)]">Rent (SOL)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {accounts.map((account) => (
                  <tr
                    key={account.pubkey.toBase58()}
                    className="hover:bg-cyan-500/5 transition-colors duration-150 group"
                  >
                    <td className="p-6 font-mono text-[var(--text-secondary)] text-sm flex items-center gap-2">
                       {shortenPubkey(account.pubkey.toBase58(), 6)}
                       <a
                        href={`https://solscan.io/account/${account.pubkey.toBase58()}?cluster=devnet`}
                        target="_blank"
                        rel="noreferrer"
                        className="opacity-0 group-hover:opacity-100 text-xs text-cyan-400 hover:text-cyan-300 ml-2 transition-opacity"
                      >
                        ↗
                      </a>
                    </td>
                    <td className="p-6 font-mono text-[var(--text-muted)] text-xs">
                       {shortenPubkey(account.mint.toBase58(), 4)}
                    </td>
                    <td className="p-6">
                      {account.status === 'reclaimable' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                          Reclaimable
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-700/50 text-slate-400">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="p-6 text-right font-mono text-[var(--text-primary)]">
                       {formatSol(account.lamports)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
                      {account.status === 'reclaimable' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                          Reclaimable
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-700/50 text-slate-400">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right font-mono text-slate-300">
                      {formatSol(account.lamports)}
                    </td>
                  </tr >
                ))}
              </tbody >
            </table >
          )}
        </div >
      </div >

  {(error || reclaimError) && (
    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-center animate-fade-in">
      Error: {error || reclaimError}
    </div>
  )}
    </div >
  );
};
