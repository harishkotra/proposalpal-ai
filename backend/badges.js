// Badge/Achievement definitions for ProposalPal AI

export const BADGES = {
    FIRST_VOTE: {
        id: 'first_vote',
        name: 'First Vote',
        description: 'Cast your first vote on a CIP',
        icon: '🗳️',
        tier: 'bronze',
        requirement: { type: 'vote_count', value: 1 }
    },
    ACTIVE_VOTER: {
        id: 'active_voter',
        name: 'Active Voter',
        description: 'Vote on 10 CIPs',
        icon: '✅',
        tier: 'bronze',
        requirement: { type: 'vote_count', value: 10 }
    },
    DEDICATED_VOTER: {
        id: 'dedicated_voter',
        name: 'Dedicated Voter',
        description: 'Vote on 50 CIPs',
        icon: '🌟',
        tier: 'silver',
        requirement: { type: 'vote_count', value: 50 }
    },
    GOVERNANCE_CHAMPION: {
        id: 'governance_champion',
        name: 'Governance Champion',
        description: 'Vote on 100 CIPs',
        icon: '🏆',
        tier: 'gold',
        requirement: { type: 'vote_count', value: 100 }
    },
    TOP_TEN: {
        id: 'top_ten',
        name: 'Top 10',
        description: 'Reach top 10 on the leaderboard',
        icon: '🔟',
        tier: 'silver',
        requirement: { type: 'leaderboard_rank', value: 10 }
    },
    TOP_THREE: {
        id: 'top_three',
        name: 'Top 3',
        description: 'Reach top 3 on the leaderboard',
        icon: '🥉',
        tier: 'gold',
        requirement: { type: 'leaderboard_rank', value: 3 }
    },
    LEADERBOARD_KING: {
        id: 'leaderboard_king',
        name: 'Leaderboard King',
        description: 'Reach #1 on the leaderboard',
        icon: '👑',
        tier: 'platinum',
        requirement: { type: 'leaderboard_rank', value: 1 }
    },
    CREDIT_BUYER: {
        id: 'credit_buyer',
        name: 'Supporter',
        description: 'Purchase credits to support the platform',
        icon: '💳',
        tier: 'bronze',
        requirement: { type: 'credits_purchased', value: 1 }
    },
    POWER_USER: {
        id: 'power_user',
        name: 'Power User',
        description: 'Purchase credits 5 times',
        icon: '⚡',
        tier: 'silver',
        requirement: { type: 'credits_purchased', value: 5 }
    },
    EARLY_BIRD: {
        id: 'early_bird',
        name: 'Early Bird',
        description: 'Vote within the first hour of a CIP being added',
        icon: '🐦',
        tier: 'silver',
        requirement: { type: 'special', value: 'early_bird' }
    },
    STREAK_WEEK: {
        id: 'streak_week',
        name: 'Weekly Streak',
        description: 'Vote on at least one CIP every day for 7 days',
        icon: '🔥',
        tier: 'silver',
        requirement: { type: 'streak', value: 7 }
    },
    COMMUNITY_VOICE: {
        id: 'community_voice',
        name: 'Community Voice',
        description: 'Vote on 5 CIPs in a single day',
        icon: '📢',
        tier: 'bronze',
        requirement: { type: 'daily_votes', value: 5 }
    }
};

// Helper function to check which badges a user should have
export async function checkUserBadges(db, walletAddress) {
    const earnedBadges = [];

    try {
        // Get user stats
        const voteCountResult = await db.query(
            'SELECT COUNT(*)::int as vote_count FROM votes WHERE wallet_address = $1',
            [walletAddress]
        );
        const voteCount = voteCountResult.rows[0]?.vote_count || 0;

        // Get leaderboard rank
        const leaderboardResult = await db.query(
            'SELECT wallet_address, COUNT(id) as points FROM votes GROUP BY wallet_address ORDER BY points DESC'
        );
        const rank = leaderboardResult.rows.findIndex(v => v.wallet_address === walletAddress) + 1;

        // Get credits purchased count
        const userResult = await db.query(
            'SELECT credits_purchased FROM users WHERE wallet_address = $1',
            [walletAddress]
        );
        const creditsPurchased = userResult.rows[0]?.credits_purchased || 0;
        const timesPurchased = creditsPurchased > 0 ? Math.floor(creditsPurchased / 1500) : 0;

        // Check vote count badges
        if (voteCount >= 1) earnedBadges.push(BADGES.FIRST_VOTE.id);
        if (voteCount >= 10) earnedBadges.push(BADGES.ACTIVE_VOTER.id);
        if (voteCount >= 50) earnedBadges.push(BADGES.DEDICATED_VOTER.id);
        if (voteCount >= 100) earnedBadges.push(BADGES.GOVERNANCE_CHAMPION.id);

        // Check leaderboard badges
        if (rank > 0 && rank <= 10) earnedBadges.push(BADGES.TOP_TEN.id);
        if (rank > 0 && rank <= 3) earnedBadges.push(BADGES.TOP_THREE.id);
        if (rank === 1) earnedBadges.push(BADGES.LEADERBOARD_KING.id);

        // Check credit purchase badges
        if (timesPurchased >= 1) earnedBadges.push(BADGES.CREDIT_BUYER.id);
        if (timesPurchased >= 5) earnedBadges.push(BADGES.POWER_USER.id);

        // Check daily votes badge
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const dailyVotesResult = await db.query(
            'SELECT COUNT(*)::int as daily_count FROM votes WHERE wallet_address = $1 AND timestamp >= $2',
            [walletAddress, todayStart.toISOString()]
        );
        const dailyVotes = dailyVotesResult.rows[0]?.daily_count || 0;
        if (dailyVotes >= 5) earnedBadges.push(BADGES.COMMUNITY_VOICE.id);

    } catch (error) {
        console.error('Error checking badges:', error);
    }

    return earnedBadges;
}

// Get new badges that were just earned
export function getNewBadges(previousBadges, currentBadges) {
    return currentBadges.filter(badge => !previousBadges.includes(badge));
}
