import { NavLink } from 'react-router-dom';
import { useAddress } from '@meshsdk/react';
import { CardanoWallet } from '@meshsdk/react';
import { Vote, BarChart3, Trophy, CreditCard, HelpCircle, Sun, Moon } from 'lucide-react';
import { useCredits } from '../context/CreditsContext';
import { useTheme } from '../hooks/useTheme';
import './Header.css';

export default function Header() {
  const address = useAddress();
  const { credits, loadingCredits } = useCredits();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="header">
      <div className="header-container">
        {/* Group Logo and Nav together */}
        <div className="header-left-side">
          <div className="logo">
            <Vote className="logo-icon" size={24} />
            ProposalPal AI
          </div>
          <nav className="nav">
            <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <Vote size={18} />
              <span>Vote</span>
            </NavLink>
            <NavLink to="/faq" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <HelpCircle size={18} />
              <span>FAQ</span>
            </NavLink>
            {address && (
              <>
                <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                  <BarChart3 size={18} />
                  <span>Dashboard</span>
                </NavLink>
                <NavLink to="/leaderboard" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                  <Trophy size={18} />
                  <span>Leaderboard</span>
                </NavLink>
                <NavLink to="/billing" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                  <CreditCard size={18} />
                  <span>Billing</span>
                </NavLink>
              </>
            )}
          </nav>
        </div>

        {/* Right side elements */}
        <div className="header-right-side">
          {address && (
            <div className="credits-display">
              {loadingCredits || typeof credits.remaining !== 'number' ? '...' : `${credits.remaining} credits`}
            </div>
          )}
          <button onClick={toggleTheme} className="theme-switcher" aria-label="Toggle theme">
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
          <div className="wallet-connector">
            <CardanoWallet />
          </div>
        </div>
      </div>
    </header>
  );
}