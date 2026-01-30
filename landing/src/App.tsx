
import { useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import { LandingPage } from './components/LandingPage';
import { WalletContextProvider } from './components/WalletContextProvider';
import './landing.css';

function WebApp() {
  const { connection } = useConnection();

  return (
    <div className="min-h-screen bg-[var(--bg-dark)] text-white flex flex-col items-center">
      {/* Navbar */}
      <nav className="nav">
        <div className="container nav-content">
          <div className="logo">
            <span className="logo-icon">🧹</span>
            <span className="logo-text">Vacuum</span>
            <span className="badge-app">App</span>
          </div>
          <div className="nav-links">
            <div className="text-xs font-mono text-slate-500 mr-4">
              RPC: {connection.rpcEndpoint.includes('helius') ? 'Helius' : 'Devnet'}
            </div>
            <WalletMultiButton />
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="app-container">
        <div className="app-content">
          <div className="app-header">
            <h1 className="app-title">Dashboard</h1>
            <p className="app-subtitle">Manage and reclaim rent from your connected wallet.</p>
          </div>

          <Dashboard />
        </div>
      </div>

      {/* Footer */}
      <footer className="footer mt-auto w-full">
        <div className="container">
          <div className="footer-content">
            <p className="footer-text">
              Vacuum Web Interface • <a href="/">Return to Home</a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/app"
          element={
            <WalletContextProvider>
              <WebApp />
            </WalletContextProvider>
          }
        />
      </Routes>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#1e293b',
            color: '#fff',
            border: '1px solid #334155',
          },
          success: {
            iconTheme: {
              primary: '#22d3ee',
              secondary: '#1e293b',
            },
          },
        }}
      />
    </BrowserRouter>
  );
}

export default App;
