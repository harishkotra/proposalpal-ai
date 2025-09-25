import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useAddress } from '@meshsdk/react';
import './LeaderboardPage.css';

const RefreshIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
);

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const address = useAddress(); // Hook to check if wallet is connected

  const fetchLeaderboard = useCallback(() => {
    setLoading(true);
    axios.get(`${import.meta.env.VITE_API_URL}/leaderboard`)
      .then(response => {
        setLeaderboard(response.data);
      })
      .catch(err => {
        console.error("Failed to fetch leaderboard:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (address) { // Only fetch data if the user is connected
      fetchLeaderboard();
    }
  }, [address, fetchLeaderboard]);

  // 1. If wallet is not connected, show a prompt
  if (!address) {
    return (
      <div className="hero-section">
        <h1>Governance Leaderboard</h1>
        <p>Please connect your wallet to view your rank and participate.</p>
      </div>
    );
  }

  const getRankIcon = (rank) => {
    if (rank === 1) return '🏆';
    if (rank === 2) return '🥈';
    return rank;
  };

  return (
    <div className="leaderboard-container">
      <div className="hero-section">
          <h1>Governance Leaderboard</h1>
          <p>Top participants in Cardano governance voting</p>
      </div>
      
      <div className="leaderboard-controls">
          <button onClick={fetchLeaderboard} disabled={loading} className="refresh-button">
            <RefreshIcon />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
      </div>

      <div className="leaderboard-list">
        <div className="leaderboard-header">
          <span className="rank-col">Rank</span>
          <span className="voter-col">Voter</span>
          <span className="votes-col">Votes</span>
          <span className="points-col">Points</span>
        </div>
        
        {loading ? (
            <div className="leaderboard-empty-row">Loading leaderboard...</div>
        ) : leaderboard.length > 0 ? (
          leaderboard.map((voter, index) => (
            <div key={voter.wallet_address} className={`leaderboard-row ${voter.wallet_address === address ? 'user-row' : ''}`}>
              <span className="rank-col">{getRankIcon(index + 1)}</span>
              <span className="voter-col voter-address">
                {voter.wallet_address.substring(0, 10)}...{voter.wallet_address.substring(voter.wallet_address.length - 8)}
                {voter.wallet_address === address && <span className="you-tag">YOU</span>}
              </span>
              <span className="votes-col">{voter.votes}</span>
              <span className="points-col">{voter.points}</span>
            </div>
          ))
        ) : (
            <div className="leaderboard-empty-row">No voters on the leaderboard yet.</div>
        )}
      </div>
      
      {/* 2. Disclaimer */}
      <p className="disclaimer-text">
          Disclaimer: Votes cast within ProposalPal AI are for community engagement and do not represent official on-chain Cardano governance votes.
      </p>

      {/* 3. "How Rankings Work" with new content */}
      <div className="how-it-works-card">
          <h2>How Rankings Work</h2>
          <div className="how-it-works-content">
              <div className="how-it-works-item">
                  <span className="how-it-works-emoji">🗳️</span>
                  <p>Cast votes on CIPs to earn points and climb the leaderboard.</p>
              </div>
              <div className="how-it-works-item">
                  <span className="how-it-works-emoji">⭐</span>
                  <p>Each vote you cast earns you 1 governance point.</p>
              </div>
              <div className="how-it-works-item">
                  <span className="how-it-works-emoji">📈</span>
                  <p>Your rank is determined by the total points you've earned.</p>
              </div>
              <div className="how-it-works-item">
                  <span className="how-it-works-emoji">💡</span>
                  <p>Leaderboard updates happen instantly after your vote is confirmed.</p>
              </div>
              <p className="how-it-works-description">
                  The leaderboard is more than just a ranking; it's a way to recognize and reward active participation. By contributing your opinion on Cardano Improvement Proposals (CIPs), you help signal community sentiment and play a part in shaping the future of the ecosystem. Your engagement helps create a more vibrant and decentralized governance process.
              </p>
          </div>
      </div>
    </div>
  );
}