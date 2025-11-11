import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { setupDatabase } from './database.js';
import OpenAI from 'openai';
import axios from 'axios';
import crypto from 'crypto';
import { BlockFrostAPI } from '@blockfrost/blockfrost-js';
import { BADGES, checkUserBadges, getNewBadges } from './badges.js';

dotenv.config({ path: `.env.${process.env.NODE_ENV || 'local'}` });
const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const gaiaNode = new OpenAI({
    baseURL: process.env.GAIA_NODE_URL,
    apiKey: process.env.GAIA_API_KEY,
});

// Initialize Blockfrost Client
const blockfrost = new BlockFrostAPI({
    projectId: process.env.BLOCKFROST_API_KEY,
    isTestnet: process.env.CARDANO_NETWORK === 'preprod',
});


let db;

// Initialize database before starting server
async function initializeServer() {
    db = await setupDatabase();
    console.log('Database initialized successfully');
}

// Start initialization
initializeServer().catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});

// --- API Endpoints ---

app.post('/api/summarize-cip', async (req, res) => {
    const { walletAddress, cipNumber } = req.body;
    if (!walletAddress || !cipNumber) return res.status(400).json({ error: 'Required fields missing.' });

    try {
        const cachedResult = await db.query('SELECT title, summary FROM summaries_cache WHERE cip_number = $1', [cipNumber]);
        if (cachedResult.rows[0]) {
            console.log(`[CACHE HIT] Serving summary for ${cipNumber} from cache.`);
            await db.query('INSERT INTO activity_log (wallet_address, cip_number, was_cached) VALUES ($1, $2, $3)', [walletAddress, cipNumber, true]);
            return res.json(cachedResult.rows[0]);
        }

        console.log(`[CACHE MISS] Generating new summary for ${cipNumber}.`);
        const userResult = await db.query('SELECT credits_remaining FROM users WHERE wallet_address = $1', [walletAddress]);
        let user = userResult.rows[0];

        if (!user) {
            await db.query('INSERT INTO users (wallet_address) VALUES ($1)', [walletAddress]);
            user = { credits_remaining: 500 };
        }
        if (user.credits_remaining <= 0) return res.status(402).json({ error: 'Payment required.' });

        const cipContentUrl = `https://raw.githubusercontent.com/cardano-foundation/CIPs/refs/heads/master/${cipNumber}/README.md`;
        const response = await axios.get(cipContentUrl);
        const systemPrompt = "You are an expert Cardano analyst...";
        const userPrompt = `Please summarize the following content from ${cipNumber}:\n\n---\n\n${response.data}`;
        const chatCompletion = await gaiaNode.chat.completions.create({ model: process.env.GAIA_MODEL_NAME, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }] });

        const finalSummary = chatCompletion.choices[0].message.content;
        const finalTitle = `Summary for ${cipNumber}`;

        await db.query('INSERT INTO summaries_cache (cip_number, title, summary) VALUES ($1, $2, $3)', [cipNumber, finalTitle, finalSummary]);
        await db.query('UPDATE users SET credits_remaining = credits_remaining - 1 WHERE wallet_address = $1', [walletAddress]);
        await db.query('INSERT INTO activity_log (wallet_address, cip_number, was_cached) VALUES ($1, $2, $3)', [walletAddress, cipNumber, false]);
        
        res.json({ title: finalTitle, summary: finalSummary });
    } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
            return res.status(404).json({ error: `Could not find content for ${cipNumber}.` });
        }
        console.error("Error during summarization:", error);
        res.status(500).json({ error: 'Failed to generate summary.' });
    }
});

app.post('/api/vote', async (req, res) => {
    const { walletAddress, cipNumber, voteChoice } = req.body;
    if (!walletAddress || !cipNumber || !voteChoice) return res.status(400).json({ error: 'Missing fields' });
    try {
        const result = await db.query('INSERT INTO votes (wallet_address, cip_number, vote_choice) VALUES ($1, $2, $3) RETURNING id', [walletAddress, cipNumber, voteChoice]);

        // Check for new badges after voting
        try {
            const storedResult = await db.query(
                'SELECT badge_id FROM user_badges WHERE wallet_address = $1',
                [walletAddress]
            );
            const storedBadgeIds = storedResult.rows.map(row => row.badge_id);
            const earnedBadgeIds = await checkUserBadges(db, walletAddress);
            const newBadgeIds = getNewBadges(storedBadgeIds, earnedBadgeIds);

            // Award new badges
            for (const badgeId of newBadgeIds) {
                await db.query(
                    'INSERT INTO user_badges (wallet_address, badge_id) VALUES ($1, $2)',
                    [walletAddress, badgeId]
                );
            }

            // Return vote success with new badges
            const newBadges = newBadgeIds.map(badgeId =>
                BADGES[Object.keys(BADGES).find(key => BADGES[key].id === badgeId)]
            ).filter(badge => badge !== undefined);

            res.status(201).json({ success: true, id: result.rows[0].id, newBadges });
        } catch (badgeError) {
            console.error('Error checking badges after vote:', badgeError);
            // Still return success for the vote even if badge checking fails
            res.status(201).json({ success: true, id: result.rows[0].id, newBadges: [] });
        }
    } catch (error) {
        if (error.code === '23505') return res.status(409).json({ error: 'User has already voted on this CIP' });
        res.status(500).json({ error: 'Database error', details: error.message });
    }
});

app.post('/api/confirm-payment', async (req, res) => {
    const { walletAddress, txHash } = req.body;
    if (!txHash) return res.status(400).json({ error: 'Transaction hash required.' });
    try {
        const existingTxResult = await db.query('SELECT tx_hash FROM claimed_transactions WHERE tx_hash = $1', [txHash]);
        if (existingTxResult.rows[0]) return res.status(409).json({ error: 'Transaction already used.' });
        
        const txInfo = await blockfrost.txsUtxos(txHash);
        const paymentAddress = process.env.PAYMENT_WALLET_ADDRESS;
        const requiredAmount = process.env.VITE_PAYMENT_AMOUNT;
        const paymentVerified = txInfo.outputs.some(o => o.address === paymentAddress && o.amount.some(a => a.unit === 'lovelace' && BigInt(a.quantity) >= BigInt(requiredAmount)));

        if (paymentVerified) {
            const creditsToAdd = 1500;
            await db.query('INSERT INTO claimed_transactions (tx_hash) VALUES ($1)', [txHash]);
            await db.query('UPDATE users SET credits_remaining = credits_remaining + $1, credits_purchased = credits_purchased + $1 WHERE wallet_address = $2', [creditsToAdd, walletAddress]);
            return res.json({ success: true, message: `${creditsToAdd} credits added.` });
        } else {
            return res.status(400).json({ error: 'Payment not found in transaction.' });
        }
    } catch (error) {
        if (error.status === 404) return res.status(404).json({ error: 'Transaction not found.' });
        console.error('Blockfrost API Error:', error);
        return res.status(500).json({ error: 'Failed to verify transaction.' });
    }
});

app.get('/api/leaderboard', async (req, res) => {
    try {
        if (!db) {
            console.error('Database not initialized yet');
            return res.status(503).json({ error: 'Database not ready' });
        }
        const result = await db.query(`SELECT wallet_address, COUNT(id)::int as votes, COUNT(id)::int as points FROM votes GROUP BY wallet_address ORDER BY points DESC`);
        res.json(result.rows);
    } catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).json({ error: 'Database error', details: error.message });
    }
});

app.get('/api/dashboard/:walletAddress', async (req, res) => {
    const { walletAddress } = req.params;
    try {
        const historyResult = await db.query('SELECT cip_number, vote_choice, timestamp FROM votes WHERE wallet_address = $1 ORDER BY timestamp DESC', [walletAddress]);
        const statsResult = await db.query('SELECT COUNT(id)::int as "totalVotes", COUNT(id)::int as "governancePoints" FROM votes WHERE wallet_address = $1', [walletAddress]);
        const leaderboardResult = await db.query(`SELECT wallet_address, COUNT(id) as points FROM votes GROUP BY wallet_address ORDER BY points DESC`);
        const rank = leaderboardResult.rows.findIndex(v => v.wallet_address === walletAddress) + 1;
        res.json({ ...statsResult.rows[0], leaderboardRank: rank > 0 ? rank : 'N/A', votingHistory: historyResult.rows });
    } catch (error) { res.status(500).json({ error: 'Database error' }); }
});

app.get('/api/votes/:walletAddress', async (req, res) => {
    const { walletAddress } = req.params;
    try {
        const result = await db.query('SELECT cip_number, vote_choice FROM votes WHERE wallet_address = $1', [walletAddress]);
        res.json(result.rows);
    } catch (error) { res.status(500).json({ error: 'Database error' }); }
});

app.get('/api/vote-stats/:cipNumber', async (req, res) => {
    const { cipNumber } = req.params;
    try {
        const result = await db.query(`
            SELECT
                vote_choice,
                COUNT(*)::int as count
            FROM votes
            WHERE cip_number = $1
            GROUP BY vote_choice
        `, [cipNumber]);

        // Calculate totals
        const stats = {
            yes: 0,
            no: 0,
            abstain: 0,
            total: 0
        };

        result.rows.forEach(row => {
            const choice = row.vote_choice.toLowerCase();
            stats[choice] = row.count;
            stats.total += row.count;
        });

        res.json(stats);
    } catch (error) {
        console.error('Vote stats error:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/credits/:walletAddress', async (req, res) => {
    const { walletAddress } = req.params;
    const DEFAULT_FREE_CREDITS = 500;
    const userResult = await db.query('SELECT credits_remaining, credits_purchased FROM users WHERE wallet_address = $1', [walletAddress]);
    let user = userResult.rows[0];
    if (!user) {
        await db.query('INSERT INTO users (wallet_address, credits_remaining, credits_purchased) VALUES ($1, $2, $3)', [walletAddress, DEFAULT_FREE_CREDITS, 0]);
        user = { credits_remaining: DEFAULT_FREE_CREDITS, credits_purchased: 0 };
    }
    const totalCredits = DEFAULT_FREE_CREDITS + user.credits_purchased;
    const consumedCredits = totalCredits - user.credits_remaining;
    res.json({ remaining: user.credits_remaining, consumed: consumedCredits, total: totalCredits });
});

app.post('/api/translate', async (req, res) => {
    const { textToTranslate, targetLanguage } = req.body;
    if (!textToTranslate || !targetLanguage) return res.status(400).json({ error: 'Missing fields' });
    const originalTextHash = crypto.createHash('sha256').update(textToTranslate).digest('hex');
    try {
        const cachedResult = await db.query('SELECT translated_text FROM translations_cache WHERE original_text_hash = $1 AND target_language = $2', [originalTextHash, targetLanguage]);
        if (cachedResult.rows[0]) return res.json({ translatedText: cachedResult.rows[0].translated_text });
        const systemPrompt = "You are a professional, multilingual translator...";
        const userPrompt = `Translate the following text into ${targetLanguage}:\n\n---\n\n${textToTranslate}`;
        const chatCompletion = await gaiaNode.chat.completions.create({ model: process.env.GAIA_MODEL_NAME, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }] });
        const translatedText = chatCompletion.choices[0].message.content;
        await db.query('INSERT INTO translations_cache (original_text_hash, target_language, translated_text) VALUES ($1, $2, $3)', [originalTextHash, targetLanguage, translatedText]);
        res.json({ translatedText });
    } catch (error) { res.status(500).json({ error: 'Failed to translate summary.' }); }
});

app.post('/api/community-insights', async (req, res) => {
    const { cipNumber } = req.body;
    if (!cipNumber) return res.status(400).json({ error: 'CIP number required.' });

    try {
        // Check cache first
        const cipHash = crypto.createHash('sha256').update(cipNumber).digest('hex');
        const cachedResult = await db.query('SELECT insights FROM community_insights_cache WHERE cip_hash = $1', [cipHash]);
        if (cachedResult.rows[0]) {
            console.log(`[CACHE HIT] Serving community insights for ${cipNumber} from cache.`);
            return res.json({ insights: cachedResult.rows[0].insights });
        }

        console.log(`[CACHE MISS] Generating new community insights for ${cipNumber}.`);

        // Step 1: Search Cardano forum for the CIP
        const searchUrl = `https://forum.cardano.org/search.json?q=${cipNumber}`;
        const searchResponse = await axios.get(searchUrl);

        const postIds = searchResponse.data?.grouped_search_result?.post_ids || [];

        if (postIds.length === 0) {
            return res.json({ insights: 'No community discussions found for this CIP on the Cardano forum.' });
        }

        // Step 2: Fetch all posts details
        const postPromises = postIds.map(postId =>
            axios.get(`https://forum.cardano.org/posts/${postId}.json`)
                .then(response => response.data.raw)
                .catch(error => {
                    console.error(`Failed to fetch post ${postId}:`, error.message);
                    return null;
                })
        );

        const postContents = await Promise.all(postPromises);
        const validPosts = postContents.filter(content => content !== null);

        if (validPosts.length === 0) {
            return res.json({ insights: 'Unable to fetch community discussion details for this CIP.' });
        }

        // Step 3: Combine all posts and summarize community sentiment
        const combinedContent = validPosts.join('\n\n---\n\n');
        const systemPrompt = "You are an expert Cardano community analyst. Your task is to analyze community discussions and extract key insights, sentiment, and important points of debate or consensus.";
        const userPrompt = `Analyze the following community forum discussions about ${cipNumber} and provide a concise summary of:\n1. Overall community sentiment (positive, negative, mixed, neutral)\n2. Key points of support or opposition\n3. Main concerns or questions raised\n4. Areas of consensus or debate\n\nForum discussions:\n\n${combinedContent}`;

        const chatCompletion = await gaiaNode.chat.completions.create({
            model: process.env.GAIA_MODEL_NAME,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ]
        });

        const insights = chatCompletion.choices[0].message.content;

        // Cache the results
        await db.query('INSERT INTO community_insights_cache (cip_hash, cip_number, insights) VALUES ($1, $2, $3)', [cipHash, cipNumber, insights]);

        res.json({ insights });
    } catch (error) {
        console.error('Error fetching community insights:', error);
        if (axios.isAxiosError(error) && error.response?.status === 404) {
            return res.status(404).json({ error: 'Forum data not found.' });
        }
        res.status(500).json({ error: 'Failed to fetch community insights.' });
    }
});

// Get all earned badges for a user
app.get('/api/badges/:walletAddress', async (req, res) => {
    const { walletAddress } = req.params;
    try {
        const result = await db.query(
            'SELECT badge_id, earned_at FROM user_badges WHERE wallet_address = $1 ORDER BY earned_at DESC',
            [walletAddress]
        );

        // Enrich with badge details
        const earnedBadges = result.rows.map(row => ({
            ...BADGES[Object.keys(BADGES).find(key => BADGES[key].id === row.badge_id)],
            earnedAt: row.earned_at
        }));

        res.json(earnedBadges);
    } catch (error) {
        console.error('Error fetching badges:', error);
        res.status(500).json({ error: 'Failed to fetch badges' });
    }
});

// Check and award new badges
app.post('/api/badges/check/:walletAddress', async (req, res) => {
    const { walletAddress } = req.params;
    try {
        // Get currently stored badges
        const storedResult = await db.query(
            'SELECT badge_id FROM user_badges WHERE wallet_address = $1',
            [walletAddress]
        );
        const storedBadgeIds = storedResult.rows.map(row => row.badge_id);

        // Check what badges should be earned
        const earnedBadgeIds = await checkUserBadges(db, walletAddress);

        // Find new badges
        const newBadgeIds = getNewBadges(storedBadgeIds, earnedBadgeIds);

        // Award new badges
        for (const badgeId of newBadgeIds) {
            await db.query(
                'INSERT INTO user_badges (wallet_address, badge_id) VALUES ($1, $2)',
                [walletAddress, badgeId]
            );
        }

        // Return new badges with full details
        const newBadges = newBadgeIds.map(badgeId =>
            BADGES[Object.keys(BADGES).find(key => BADGES[key].id === badgeId)]
        ).filter(badge => badge !== undefined);

        res.json({ newBadges });
    } catch (error) {
        console.error('Error checking badges:', error);
        res.status(500).json({ error: 'Failed to check badges' });
    }
});

app.listen(port, () => {
    console.log(`Backend server running at http://localhost:${port}`);
    console.log(`Using environment: ${process.env.NODE_ENV || 'local'}`);
});