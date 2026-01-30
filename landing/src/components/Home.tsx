
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { type FC } from 'react';
import { Dashboard } from './Dashboard';

export const Home: FC = () => {
  const { publicKey } = useWallet();
  const { connection } = useConnection();

  return (
    <>
      {/* Gradient Background */}
      <div className="gradient-bg"></div>

      {/* Navigation */}
      <nav className="nav">
        <div className="container nav-content">
          <div className="logo">
            <span className="logo-icon">🧹</span>
            <span className="logo-text">Vacuum</span>
          </div>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#docs">Docs</a>
            {/* Wallet Button in Mobile/Desktop Nav */}
            <WalletMultiButton />
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="hero">
        <div className="container">
          <div className="hero-badge">
            <span>🏆 SuperteamNG Bounty</span>
          </div>
          <h1 className="hero-title">
            Stop Losing SOL to<br />
            <span className="gradient-text">Forgotten Rent</span>
          </h1>
          <p className="hero-subtitle">
            The ultimate CLI & SDK to automatically detect and reclaim rent from
            inactive sponsored accounts.<br />
            Suck up every forgotten lamport. Get your SOL back.
          </p>

          {!publicKey && (
            <div className="hero-cta">
              <div className="transform hover:scale-105 transition-transform duration-200">
                <WalletMultiButton />
              </div>
              <a href="#how-it-works" className="btn btn-ghost">Learn More →</a>
            </div>
          )}

          {/* DASHBOARD INTEGRATION */}
          {publicKey && (
            <div className="animate-fade-in mt-8 mb-16">
              <div className="inline-block px-4 py-1.5 rounded-full bg-slate-800/50 border border-slate-700/50 text-slate-400 text-xs font-mono mb-8 backdrop-blur-md">
                Connected to: {connection.rpcEndpoint.includes('helius') ? 'Helius RPC' : 'Devnet Public'}
              </div>
              <Dashboard />
            </div>
          )}

          {/* Terminal Preview (Only show if dashboard is NOT active to save space/focus) */}
          {!publicKey && (
            <div className="terminal">
              <div className="terminal-header">
                <div className="terminal-dots">
                  <span></span><span></span><span></span>
                </div>
                <span className="terminal-title">vacuum</span>
              </div>
              <div className="terminal-body">
                <div className="terminal-line">
                  <span className="prompt">$</span> vacuum check --all
                </div>
                <div className="terminal-output">
                  <span className="info">[INFO]</span> Checking 150 tracked accounts...
                </div>
                <div className="terminal-output">
                  <span className="success">[SUCCESS]</span> Found 42 reclaimable
                  accounts
                </div>
                <div className="terminal-output blank"></div>
                <div className="terminal-output">
                  📊 <span className="highlight">Reclaimable Summary:</span>
                </div>
                <div className="terminal-output">
                  &nbsp;&nbsp;- Safe to reclaim:
                  <span className="value">42 accounts</span>
                </div>
                <div className="terminal-output">
                  &nbsp;&nbsp;- Total reclaimable:
                  <span className="value">0.086 SOL</span>
                </div>
                <div className="terminal-output">
                  &nbsp;&nbsp;- Needs review: <span className="value">0 accounts</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Problem Section */}
      <section className="problem">
        <div className="container">
          <h2 className="section-title">The Hidden Cost of Sponsorship</h2>
          <div className="problem-grid">
            <div className="problem-card">
              <div className="problem-icon">💰</div>
              <h3>Rent Gets Locked</h3>
              <p>
                Every sponsored account locks ~0.002 SOL as rent. Create thousands
                of accounts? That's real money locked up.
              </p>
            </div>
            <div className="problem-card">
              <div className="problem-icon">👻</div>
              <h3>Accounts Go Inactive</h3>
              <p>
                Users empty their wallets, close apps, move on. Their sponsored
                accounts stay open, holding your SOL hostage.
              </p>
            </div>
            <div className="problem-card">
              <div className="problem-icon">🔍</div>
              <h3>No Visibility</h3>
              <p>
                Without tracking, you have no idea how much rent is locked or
                which accounts can be safely reclaimed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features">
        <div className="container">
          <h2 className="section-title">Everything You Need</h2>
          <p className="section-subtitle">A complete toolkit for rent recovery</p>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🔍</div>
              <h3>Smart Detection</h3>
              <p>
                Automatically finds token accounts with zero balance that are safe
                to close and reclaim.
              </p>
            </div>
            <div className="feature-card highlight">
              <div className="feature-icon">🛡️</div>
              <h3>Safety First</h3>
              <p>
                Dry-run mode, whitelists, and balance verification ensure you
                never close active accounts.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🤖</div>
              <h3>Telegram Bot</h3>
              <p>
                Monitor and trigger reclaims from your phone with our built-in
                Telegram integration.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Audit Trail</h3>
              <p>
                Every reclaim is logged with transaction signatures for complete
                transparency.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⏰</div>
              <h3>Automation Ready</h3>
              <p>
                Run on a schedule with cron, PM2, or GitHub Actions. Set it and
                forget it.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">💻</div>
              <h3>CLI & SDK</h3>
              <p>
                Powerful command-line tool for ops, and a full TypeScript SDK for
                integrating rent reclamation into your own backend.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="how-it-works">
        <div className="container">
          <h2 className="section-title">How It Works</h2>
          <div className="steps">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h3>Scan</h3>
                <p>Find all token accounts owned by your operator wallet</p>
                <code>vacuum scan</code>
              </div>
            </div>
            <div className="step-connector"></div>
            <div className="step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h3>Detect</h3>
                <p>Identify accounts with zero balance (safe to close)</p>
                <code>vacuum check --all</code>
              </div>
            </div>
            <div className="step-connector"></div>
            <div className="step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h3>Reclaim</h3>
                <p>Close accounts and return rent to your treasury</p>
                <code>vacuum reclaim --yes</code>
              </div>
            </div>
            <div className="step-connector"></div>
            <div className="step">
              <div className="step-number">4</div>
              <div className="step-content">
                <h3>Report</h3>
                <p>Track total locked vs reclaimed over time</p>
                <code>vacuum report</code>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-logo">
              <span className="logo-icon">🧹</span>
              <span className="logo-text">Vacuum</span>
            </div>
            <p className="footer-text">
              Built for the <a href="#">SuperteamNG Bounty</a><br />
              Open source • MIT License
            </p>
          </div>
        </div>
      </footer>
    </>
  );
};
