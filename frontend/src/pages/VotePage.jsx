// client/src/pages/VotePage.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useWallet, useAddress } from '@meshsdk/react';
import { Transaction } from '@meshsdk/core';
import { useCredits } from '../context/CreditsContext';
import { parseWalletError } from '../utils/errorParser';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronDown, Search, Bot, Vote, Trophy } from 'lucide-react';
import BadgeNotification from '../components/BadgeNotification';
import './VotePage.css';

export default function VotePage() {
    const [searchInput, setSearchInput] = useState('CIP-0054');
    const [cip, setCip] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isOutOfCredits, setIsOutOfCredits] = useState(false);
    const [isPaying, setIsPaying] = useState(false);
    const [userVotes, setUserVotes] = useState([]);
    const [lastTxHash, setLastTxHash] = useState('');
    const [isVoting, setIsVoting] = useState(false);
    const [targetLanguage, setTargetLanguage] = useState('Spanish'); // Default language
    const [translatedSummary, setTranslatedSummary] = useState('');
    const [isTranslating, setIsTranslating] = useState(false);
    const [translationError, setTranslationError] = useState('');
    const [communityInsights, setCommunityInsights] = useState('');
    const [isLoadingInsights, setIsLoadingInsights] = useState(false);
    const [insightsError, setInsightsError] = useState('');
    const [isSummaryOpen, setIsSummaryOpen] = useState(true);
    const [isInsightsOpen, setIsInsightsOpen] = useState(true);
    const [voteStats, setVoteStats] = useState(null);
    const [loadingVoteStats, setLoadingVoteStats] = useState(false);
    const [newBadges, setNewBadges] = useState([]);

    const { wallet, connected } = useWallet();
    const address = useAddress();
    const { fetchCredits } = useCredits();

    // Collapsible component
    const CollapsibleSection = ({ title, isOpen, onToggle, children }) => (
        <div className="collapsible-section">
            <div className="collapsible-header" onClick={onToggle}>
                <h4>{title}</h4>
                <ChevronDown className={`collapsible-icon ${isOpen ? 'open' : ''}`} size={20} />
            </div>
            <div className={`collapsible-content ${isOpen ? 'open' : ''}`}>
                {children}
            </div>
        </div>
    );

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        if (!connected) {
            setError("Please connect your wallet to search for CIP summaries.");
            return;
        }
        setLoading(true);
        setError('');
        setCip(null);
        setIsOutOfCredits(false);
        setCommunityInsights('');
        setInsightsError('');

        try {
            const response = await axios.post(`${import.meta.env.VITE_API_URL}/summarize-cip`, {
                cipNumber: searchInput,
                walletAddress: address,
            });
            setCip({ id: searchInput, ...response.data });
            await fetchCredits();

            // Fetch community insights and vote stats in the background
            fetchCommunityInsights(searchInput);
            fetchVoteStats(searchInput);

        } catch (err) {
            if (err.response && err.response.status === 402) {
                setIsOutOfCredits(true);
                setError("You've used all your free summaries.");
            } else {
                setError(err.response?.data?.error || 'An error occurred.');
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchCommunityInsights = async (cipNumber) => {
        setIsLoadingInsights(true);
        setInsightsError('');
        setCommunityInsights('');

        try {
            const response = await axios.post(`${import.meta.env.VITE_API_URL}/community-insights`, {
                cipNumber: cipNumber,
            });
            setCommunityInsights(response.data.insights);
        } catch (err) {
            console.error('Failed to fetch community insights:', err);
            setInsightsError('Unable to load community insights at this time.');
        } finally {
            setIsLoadingInsights(false);
        }
    };

    const fetchVoteStats = async (cipNumber) => {
        setLoadingVoteStats(true);
        setVoteStats(null);

        try {
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/vote-stats/${cipNumber}`);
            setVoteStats(response.data);
        } catch (err) {
            console.error('Failed to fetch vote stats:', err);
            setVoteStats({ yes: 0, no: 0, abstain: 0, total: 0 });
        } finally {
            setLoadingVoteStats(false);
        }
    };

    const handlePayment = async () => {
        setIsPaying(true);
        setError('');
        try {
            const paymentAddress = import.meta.env.VITE_PAYMENT_WALLET_ADDRESS;
            const paymentAmount = import.meta.env.VITE_PAYMENT_AMOUNT;

            const tx = new Transaction({ initiator: wallet })
                .sendLovelace({ address: paymentAddress }, paymentAmount);
            
            const unsignedTx = await tx.build();
            const signedTx = await wallet.signTx(unsignedTx);
            const txHash = await wallet.submitTx(signedTx);

            await axios.post(`${import.meta.env.VITE_API_URL}/confirm-payment`, {
                walletAddress: address,
                txHash: txHash,
            });

            setIsOutOfCredits(false);
            await handleSearch();

        } catch (err) {
            console.error("Payment failed:", err);
            setError("Payment transaction failed. Please try again.");
        } finally {
            setIsPaying(false);
        }
    };
    
    // This hook for fetching user votes is still correct and needed.
    const fetchUserVotes = async () => {
        if (!address) return;
        try {
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/votes/${address}`);
            setUserVotes(response.data);
        } catch (err) {
            console.error("Failed to fetch user votes");
        }
    };

    useEffect(() => {
        if (connected && address) {
            fetchUserVotes();
        } else {
            setUserVotes([]);
        }
    }, [connected, address]);

    const handleTranslate = async () => {
        if (!cip || !cip.summary) return;

        setIsTranslating(true);
        setTranslationError('');
        setTranslatedSummary(''); // Clear previous translations

        try {
            const response = await axios.post(`${import.meta.env.VITE_API_URL}/translate`, {
                textToTranslate: cip.summary,
                targetLanguage: targetLanguage,
            });
            setTranslatedSummary(response.data.translatedText);
        } catch (err) {
            setTranslationError(err.response?.data?.error || 'Failed to get translation.');
        } finally {
            setIsTranslating(false);
        }
    };

    const handleVote = async (voteChoice) => {
        if (!connected || !cip) return;
        setIsVoting(true);
        setLastTxHash('');
        setError(''); 
        try {
            const tx = new Transaction({ initiator: wallet })
                .setMetadata(674, {
                    'msg': [
                        `Vote on ${cip.id}`,
                        `Choice: ${voteChoice}`
                    ]
                });

            const unsignedTx = await tx.build();
            const signedTx = await wallet.signTx(unsignedTx);
            const txHash = await wallet.submitTx(signedTx);
            
            setLastTxHash(txHash);

            // After successful transaction, record vote in our DB
            const voteResponse = await axios.post(`${import.meta.env.VITE_API_URL}/vote`, {
                walletAddress: address,
                cipNumber: cip.id,
                voteChoice: voteChoice
            });

            // Check if new badges were earned
            if (voteResponse.data.newBadges && voteResponse.data.newBadges.length > 0) {
                setNewBadges(voteResponse.data.newBadges);
            }

            // Refresh user votes and vote stats to update UI
            fetchUserVotes();
            fetchVoteStats(cip.id);

        } catch (err) {
            const friendlyError = parseWalletError(err);
            setError(friendlyError);
        } finally {
            setIsVoting(false);
        }
    };

    const alreadyVoted = userVotes.find(v => v.cip_number === cip?.id);

    return (
        <div>
            <div className="hero-section">
                <h1>Cardano Governance Made Simple</h1>
                <p>Search for Cardano Improvement Proposals (CIPs), get AI-powered summaries, and vote with your connected wallet. Participate in shaping the future of Cardano.</p>
            </div>

            <div className="vote-grid">
                <div className="card content-card">
                    <h2 className="card-title visually-hidden">Find & Understand CIPs</h2>
                    <form onSubmit={handleSearch} className="search-form">
                        <input 
                            type="text" 
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
                            placeholder="e.g., CIP-0139" 
                            className="search-input"
                        />
                        <button type="submit" className="search-button" disabled={loading}>
                            {loading ? 'Searching...' : 'Search'}
                        </button>
                    </form>

                    {error && <p className="error-message">{error}</p>}

                    {isOutOfCredits && (
                        <div className="payment-card">
                            <h4>Purchase More Summaries</h4>
                            <p>Get <strong>1500 more</strong> AI summaries for just <strong>{parseInt(import.meta.env.VITE_PAYMENT_AMOUNT) / 1000000} ADA</strong>.</p>
                            <button onClick={handlePayment} disabled={isPaying} className="payment-button">
                                {isPaying ? 'Processing Payment...' : 'Pay with Wallet'}
                            </button>
                        </div>
                    )}

                    {cip && (
                        <div className="cip-details">
                            <CollapsibleSection
                                title="AI Summary"
                                isOpen={isSummaryOpen}
                                onToggle={() => setIsSummaryOpen(!isSummaryOpen)}
                            >
                                {/* Use ReactMarkdown to render the summary */}
                                <div className="summary">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {cip.summary}
                                    </ReactMarkdown>
                                </div>

                                <a href={`https://cips.cardano.org/cip/${cip.id}`} target="_blank" rel="noopener noreferrer" className="full-cip-link">
                                    View Full CIP →
                                </a>
                            </CollapsibleSection>

                            <div className="translation-section">
                                <div className="translation-controls">
                                    <select
                                        value={targetLanguage}
                                        onChange={(e) => setTargetLanguage(e.target.value)}
                                        className="translation-select"
                                        aria-label="Select language for translation"
                                    >
                                        <option value="Spanish">Spanish</option>
                                        <option value="French">French</option>
                                        <option value="German">German</option>
                                        <option value="Japanese">Japanese</option>
                                        <option value="Chinese">Chinese</option>
                                        <option value="Hindi">Hindi</option>
                                        <option value="Portuguese">Portuguese</option>
                                    </select>
                                    <button onClick={handleTranslate} disabled={isTranslating} className="translate-button">
                                        {isTranslating ? 'Translating...' : 'Translate'}
                                    </button>
                                </div>

                                {translationError && <p className="error-message">{translationError}</p>}

                                {translatedSummary && (
                                    <div className="translated-summary-container">
                                        <h4>Summary in {targetLanguage}</h4>
                                        <div className="summary">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{translatedSummary}</ReactMarkdown>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <CollapsibleSection
                                title="Community Insights"
                                isOpen={isInsightsOpen}
                                onToggle={() => setIsInsightsOpen(!isInsightsOpen)}
                            >
                                {isLoadingInsights && (
                                    <div className="loading-insights">
                                        <p>Loading community discussions...</p>
                                    </div>
                                )}
                                {insightsError && (
                                    <p className="error-message">{insightsError}</p>
                                )}
                                {communityInsights && !isLoadingInsights && (
                                    <div className="insights-content">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {communityInsights}
                                        </ReactMarkdown>
                                    </div>
                                )}
                                {!communityInsights && !isLoadingInsights && !insightsError && (
                                    <p className="info-message">No community discussions found yet.</p>
                                )}
                            </CollapsibleSection>
                        </div>
                    )}
                </div>

                <div className="card sticky-vote-card">
                    <h2 className="card-title">Cast Your Vote</h2>
                    {!connected ? (
                        <div className="vote-placeholder">
                            <p>ⓘ Connect your wallet to vote on CIPs</p>
                        </div>
                    ) : !cip ? (
                        <div className="vote-placeholder">
                            <p>Search for a CIP to vote</p>
                        </div>
                    ) : alreadyVoted ? (
                        <div className="vote-feedback already-voted">
                            <p>✅ You have already voted</p>
                            <p>Your vote: <span className={`vote-choice-${alreadyVoted.vote_choice.toLowerCase()}`}>{alreadyVoted.vote_choice}</span></p>
                            {lastTxHash && (
                                <div className="tx-success-info">
                                    <strong>Transaction Submitted!</strong>
                                    <a 
                                        href={`${import.meta.env.VITE_CARDANOSCAN_URL}/transaction/${lastTxHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="explorer-link"
                                    >
                                        View on Cardanoscan
                                    </a>
                                </div>
                            )}
                            <p>Thank you for participating in Cardano governance!</p>
                        </div>
                    ) : (
                        <div className="vote-section">
                            <p>Vote on <strong>{cip.title}</strong></p>
                            <div className="vote-buttons">
                                <button onClick={() => handleVote('YES')} className="vote-btn yes" disabled={isVoting}>
                                    {isVoting ? 'Submitting...' : 'Yes'}
                                </button>
                                <button onClick={() => handleVote('NO')} className="vote-btn no" disabled={isVoting}>
                                    {isVoting ? 'Submitting...' : 'No'}
                                </button>
                                <button onClick={() => handleVote('ABSTAIN')} className="vote-btn abstain" disabled={isVoting}>
                                    {isVoting ? 'Submitting...' : 'Abstain'}
                                </button>
                            </div>
                            <p className="vote-note">Note: Voting creates a governance transaction with CIP-674 metadata. You can only vote once per CIP.</p>
                        </div>
                    )}

                    {/* Vote Distribution Chart */}
                    {cip && (
                        <div className="vote-distribution-section">
                            <h3 className="vote-distribution-title">Community Votes</h3>
                            {loadingVoteStats ? (
                                <p className="vote-stats-loading">Loading vote statistics...</p>
                            ) : voteStats && voteStats.total > 0 ? (
                                <div className="vote-distribution">
                                    <div className="vote-stat-item">
                                        <div className="vote-stat-header">
                                            <span className="vote-stat-label">Yes</span>
                                            <span className="vote-stat-count">{voteStats.yes} ({voteStats.total > 0 ? Math.round((voteStats.yes / voteStats.total) * 100) : 0}%)</span>
                                        </div>
                                        <div className="vote-stat-bar">
                                            <div
                                                className="vote-stat-fill yes-fill"
                                                style={{ width: `${voteStats.total > 0 ? (voteStats.yes / voteStats.total) * 100 : 0}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    <div className="vote-stat-item">
                                        <div className="vote-stat-header">
                                            <span className="vote-stat-label">No</span>
                                            <span className="vote-stat-count">{voteStats.no} ({voteStats.total > 0 ? Math.round((voteStats.no / voteStats.total) * 100) : 0}%)</span>
                                        </div>
                                        <div className="vote-stat-bar">
                                            <div
                                                className="vote-stat-fill no-fill"
                                                style={{ width: `${voteStats.total > 0 ? (voteStats.no / voteStats.total) * 100 : 0}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    <div className="vote-stat-item">
                                        <div className="vote-stat-header">
                                            <span className="vote-stat-label">Abstain</span>
                                            <span className="vote-stat-count">{voteStats.abstain} ({voteStats.total > 0 ? Math.round((voteStats.abstain / voteStats.total) * 100) : 0}%)</span>
                                        </div>
                                        <div className="vote-stat-bar">
                                            <div
                                                className="vote-stat-fill abstain-fill"
                                                style={{ width: `${voteStats.total > 0 ? (voteStats.abstain / voteStats.total) * 100 : 0}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    <div className="vote-total">
                                        <strong>Total votes:</strong> {voteStats.total}
                                    </div>
                                </div>
                            ) : (
                                <p className="no-votes-message">No votes yet on ProposalPal for this CIP. Be the first to vote!</p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Feature Highlights Section */}
            <div className="features-section">
                <div className="features-grid">
                    <div className="feature-card">
                        <div className="feature-icon">
                            <Search size={32} />
                        </div>
                        <h3 className="feature-title">🔍 Search CIPs</h3>
                        <p className="feature-description">
                            Find any Cardano Improvement Proposal by number or title
                        </p>
                    </div>

                    <div className="feature-card">
                        <div className="feature-icon">
                            <Bot size={32} />
                        </div>
                        <h3 className="feature-title">🤖 AI Summaries</h3>
                        <p className="feature-description">
                            Get plain-language explanations of complex technical proposals
                        </p>
                    </div>

                    <div className="feature-card">
                        <div className="feature-icon">
                            <Vote size={32} />
                        </div>
                        <h3 className="feature-title">🗳️ Vote Easily</h3>
                        <p className="feature-description">
                            Cast your vote directly from your connected Cardano wallet
                        </p>
                    </div>

                    <div className="feature-card">
                        <div className="feature-icon">
                            <Trophy size={32} />
                        </div>
                        <h3 className="feature-title">🏆 Earn Points</h3>
                        <p className="feature-description">
                            Gain points for each vote and climb the governance leaderboard
                        </p>
                    </div>
                </div>
            </div>

            {/* Badge notification */}
            {newBadges.length > 0 && (
                <BadgeNotification
                    badges={newBadges}
                    onClose={() => setNewBadges([])}
                />
            )}
        </div>
    );
}