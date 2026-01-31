
import { type FC } from 'react';
import { Link } from 'react-router-dom';

export const LandingPage: FC = () => {
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
            {/* Launch App Button in Nav */}
            <Link to="/app" className="btn btn-primary">
              Launch App
            </Link>
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

          <div className="hero-cta">
            <div className="transform hover:scale-105 transition-transform duration-200">
              <Link to="/app" className="btn btn-primary btn-large">
                Get Started
              </Link>
            </div>
            <a href="#how-it-works" className="btn btn-ghost">Learn More →</a>
          </div>

          {/* Terminal Preview */}
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
          {/* Features Grid code (unchanged) */}
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

      {/* SDK Documentation Section */}
      <section id="docs" className="features">
        <div className="container">
          <h2 className="section-title">Developer Documentation</h2>
          <p className="section-subtitle">Two ways to use Vacuum: CLI for operators, SDK for builders</p>

          <div className="features-grid" style={{ marginTop: '48px' }}>
            {/* CLI Card */}
            <div className="feature-card">
              <div className="feature-icon">⌨️</div>
              <h3>CLI Tool</h3>
              <p style={{ marginBottom: '16px' }}>
                Perfect for manual operation, cron jobs, and Telegram bot. No coding required.
              </p>
              <div className="terminal" style={{ marginTop: '16px', marginBottom: '0' }}>
                <div className="terminal-header">
                  <div className="terminal-dots">
                    <span></span><span></span><span></span>
                  </div>
                  <span className="terminal-title">Installation</span>
                </div>
                <div className="terminal-body" style={{ padding: '16px' }}>
                  <div className="terminal-line">
                    <span className="prompt">$</span> npm install -g vacuum-sol
                  </div>
                  <div className="terminal-output blank" style={{ height: '8px' }}></div>
                  <div className="terminal-line">
                    <span className="prompt">$</span> vacuum scan
                  </div>
                  <div className="terminal-line">
                    <span className="prompt">$</span> vacuum reclaim --yes
                  </div>
                </div>
              </div>
            </div>

            {/* SDK Card */}
            <div className="feature-card highlight">
              <div className="feature-icon">🔧</div>
              <h3>SDK (TypeScript)</h3>
              <p style={{ marginBottom: '16px' }}>
                Integrate rent reclamation into your backend, custom automation, or your own tools.
              </p>
              <div className="terminal" style={{ marginTop: '16px', marginBottom: '0' }}>
                <div className="terminal-header">
                  <div className="terminal-dots">
                    <span></span><span></span><span></span>
                  </div>
                  <span className="terminal-title">Usage</span>
                </div>
                <div className="terminal-body" style={{ padding: '16px', fontSize: '12px' }}>
                  <div className="terminal-output">
                    <span style={{ color: '#c678dd' }}>import</span> {'{'}VacuumClient{'}'} <span style={{ color: '#c678dd' }}>from</span> <span style={{ color: '#98c379' }}>'vacuum-sol'</span>
                  </div>
                  <div className="terminal-output blank" style={{ height: '8px' }}></div>
                  <div className="terminal-output">
                    <span style={{ color: '#c678dd' }}>const</span> client = <span style={{ color: '#c678dd' }}>new</span> <span style={{ color: '#61afef' }}>VacuumClient</span>({'{'}
                  </div>
                  <div className="terminal-output">
                    &nbsp;&nbsp;rpcUrl: <span style={{ color: '#98c379' }}>'https://api.mainnet...'</span>,
                  </div>
                  <div className="terminal-output">
                    &nbsp;&nbsp;treasury: <span style={{ color: '#98c379' }}>'YOUR_WALLET'</span>,
                  </div>
                  <div className="terminal-output">
                    &nbsp;&nbsp;keypairPath: <span style={{ color: '#98c379' }}>'./operator.json'</span>
                  </div>
                  <div className="terminal-output">
                    {'}'})
                  </div>
                  <div className="terminal-output blank" style={{ height: '8px' }}></div>
                  <div className="terminal-output">
                    <span style={{ color: '#c678dd' }}>const</span> accounts = <span style={{ color: '#c678dd' }}>await</span> client.<span style={{ color: '#61afef' }}>scan</span>()
                  </div>
                  <div className="terminal-output">
                    <span style={{ color: '#c678dd' }}>const</span> results = <span style={{ color: '#c678dd' }}>await</span> client.<span style={{ color: '#61afef' }}>reclaim</span>(accounts)
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Comparison Table */}
          <div style={{
            marginTop: '64px',
            background: 'var(--bg-card)',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '24px 32px',
              borderBottom: '1px solid var(--border-color)',
              background: 'var(--bg-elevated)'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>CLI vs SDK Comparison</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left'
              }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)', fontSize: '14px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '16px 32px', fontWeight: 500 }}>Feature</th>
                    <th style={{ padding: '16px 32px', fontWeight: 500 }}>CLI</th>
                    <th style={{ padding: '16px 32px', fontWeight: 500 }}>SDK</th>
                  </tr>
                </thead>
                <tbody style={{ color: 'var(--text-secondary)' }}>
                  <tr style={{ borderTop: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '16px 32px', color: 'var(--text-primary)' }}>Setup</td>
                    <td style={{ padding: '16px 32px' }}>.env file</td>
                    <td style={{ padding: '16px 32px' }}>Constructor config</td>
                  </tr>
                  <tr style={{ borderTop: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '16px 32px', color: 'var(--text-primary)' }}>Execution</td>
                    <td style={{ padding: '16px 32px' }}>Terminal commands</td>
                    <td style={{ padding: '16px 32px' }}>Function calls</td>
                  </tr>
                  <tr style={{ borderTop: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '16px 32px', color: 'var(--text-primary)' }}>Output</td>
                    <td style={{ padding: '16px 32px' }}>Console logs</td>
                    <td style={{ padding: '16px 32px' }}>Return values</td>
                  </tr>
                  <tr style={{ borderTop: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '16px 32px', color: 'var(--text-primary)' }}>Best For</td>
                    <td style={{ padding: '16px 32px' }}>Operators, cron jobs</td>
                    <td style={{ padding: '16px 32px' }}>Custom integrations</td>
                  </tr>
                </tbody>
              </table>
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
