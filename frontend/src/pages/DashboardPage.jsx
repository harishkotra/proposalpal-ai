import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAddress } from '@meshsdk/react';
import './DashboardPage.css'; // Import the new styles

const API_URL = 'http://localhost:3001/api';

// A simple external link icon component
const ExternalLinkIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
    <polyline points="15 3 21 3 21 9"></polyline>
    <line x1="10" y1="14" x2="21" y2="3"></line>
  </svg>
);


export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const address = useAddress();

  useEffect(() => {
    if (address) {
      setLoading(true);
      axios.get(`${import.meta.env.VITE_API_URL}/dashboard/${address}`)
        .then(response => {
          setDashboardData(response.data);
        })
        .catch(err => {
          console.error("Failed to fetch dashboard data:", err);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
      setDashboardData(null);
    }
  }, [address]);

  if (!address) {
    return (
      <div className="hero-section">
        <h1>Your Governance Dashboard</h1>
        <p>Connect your wallet to track your participation in Cardano governance.</p>
      </div>
    );
  }
  
  if (loading) return <p className="loading-text">Loading dashboard...</p>;
  if (!dashboardData) return <p className="loading-text">No data to display.</p>;

  return (
    <div className="dashboard-container">
        <div className="hero-section">
            <h1>Your Governance Dashboard</h1>
            <p>Track your participation in Cardano governance</p>
        </div>

        {/* --- Stats Grid --- */}
        <div className="stats-grid">
            <div className="stat-card">
                <h3>{dashboardData.totalVotes}</h3>
                <p>Total Votes Cast</p>
            </div>
            <div className="stat-card">
                <h3>{dashboardData.governancePoints}</h3>
                <p>Governance Points</p>
            </div>
             <div className="stat-card">
                <h3>{dashboardData.leaderboardRank}</h3>
                <p>Leaderboard Rank</p>
            </div>
        </div>
        
        {/* --- Voting History --- */}
        <div className="history-section">
            <h2>Your Voting History</h2>
            {dashboardData.votingHistory.length > 0 ? (
                <div className="history-list">
                    {dashboardData.votingHistory.map((vote, index) => (
                        <div key={index} className="history-item">
                            <div className="history-item-info">
                                <strong>{vote.cip_number.replace(/-/g, '-')}</strong>
                                <span>{vote.vote_choice}</span>
                                <small>{new Date(vote.timestamp).toLocaleString()}</small>
                            </div>
                            <a href={`https://cips.cardano.org/cip/${vote.cip_number}`} target="_blank" rel="noopener noreferrer" className="history-item-link">
                                <ExternalLinkIcon />
                            </a>
                        </div>
                    ))}
                </div>
            ) : (
                <p>You haven't cast any votes yet.</p>
            )}
        </div>

        {/* --- Points System --- */}
        <div className="points-system-card">
            <h2>Points System</h2>
            <ul>
                <li>Earn 1 point for each vote cast</li>
                <li>Points determine your leaderboard ranking</li>
                <li>Higher participation leads to better governance rewards</li>
            </ul>
        </div>
    </div>
  );
}