import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { setupDatabase } from './database.js';
import OpenAI from 'openai';
import axios from 'axios';
import crypto from 'crypto';
import { BlockFrostAPI } from '@blockfrost/blockfrost-js';

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
(async () => {
    db = await setupDatabase();
})();

// API Endpoints

app.post('/api/summarize-cip', async (req, res) => {
    const { walletAddress, cipNumber } = req.body;
    if (!walletAddress || !cipNumber) return res.status(400).json({ error: 'Required fields missing.' });

    try {
        const cachedResult = await db.query('SELECT * FROM summaries_cache WHERE cip_number = $1', [cipNumber]);
        if (cachedResult.rows[0]) {
            console.log(`[CACHE HIT] Serving summary for ${cipNumber} from cache.`);
            await db.query('INSERT INTO activity_log (wallet_address, cip_number, was_cached) VALUES ($1, $2, $3)', [walletAddress, cipNumber, true]);
            return res.json({ title: cachedResult.rows[0].title, summary: cachedResult.rows[0].summary });
        }

        console.log(`[CACHE MISS] Generating new summary for ${cipNumber}.`);
        const userResult = await db.query('SELECT * FROM users WHERE wallet_address = $1', [walletAddress]);
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

        const chatCompletion = await gaiaNode.chat.completions.create({
            model: process.env.GAIA_MODEL_NAME,
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        });

        const finalSummary = chatCompletion.choices[0].message.content;
        const finalTitle = `Summary for ${cipNumber}`;

        await db.query('INSERT INTO summaries_cache (cip_number, title, summary) VALUES ($1, $2, $3)', [cipNumber, finalTitle, finalSummary]);
        await db.query('UPDATE users SET credits_remaining = credits_remaining - 1 WHERE wallet_address = $1', [walletAddress]);
        await db.query('INSERT INTO activity_log (wallet_address, cip_number, was_cached) VALUES ($1, $2, $3)', [walletAddress, cipNumber, false]);
        
        res.json({ title: finalTitle, summary: finalSummary });

    } catch (error) {
        if (error.isAxiosError && error.response && error.response.status === 404) {
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
        // Use RETURNING to get the ID of the newly inserted row
        const result = await db.query(
            'INSERT INTO votes (wallet_address, cip_number, vote_choice) VALUES ($1, $2, $3) RETURNING id',
            [walletAddress, cipNumber, voteChoice]
        );
        res.status(201).json({ success: true, id: result.rows[0].id });
    } catch (error) {
        // Check for PostgreSQL's unique violation error code
        if (error.code === '23505') { 
            return res.status(409).json({ error: 'User has already voted on this CIP' });
        }
        res.status(500).json({ error: 'Database error', details: error.message });
    }
});

app.post('/api/confirm-payment', async (req, res) => {
    const { walletAddress, txHash } = req.body;
    if (!txHash) return res.status(400).json({ error: 'Transaction hash required.' });

    try {
        const existingTxResult = await db.query('SELECT tx_hash FROM claimed_transactions WHERE tx_hash = $1', [txHash]);
        if (existingTxResult.rows[0]) {
            return res.status(409).json({ error: 'Transaction already used.' });
        }

        const txInfo = await blockfrost.txsUtxos(txHash);
        const paymentAddress = process.env.PAYMENT_WALLET_ADDRESS;
        const requiredAmount = process.env.VITE_PAYMENT_AMOUNT;
        
        let paymentVerified = txInfo.outputs.some(output => 
            output.address === paymentAddress &&
            output.amount.some(amt => amt.unit === 'lovelace' && BigInt(amt.quantity) >= BigInt(requiredAmount))
        );

        if (paymentVerified) {
            const creditsToAdd = 1500;
            await db.query('INSERT INTO claimed_transactions (tx_hash) VALUES ($1)', [txHash]);
            await db.query(
                'UPDATE users SET credits_remaining = credits_remaining + $1, credits_purchased = credits_purchased + $1 WHERE wallet_address = $2',
                [creditsToAdd, walletAddress]
            );
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
        const result = await db.query(`
            SELECT wallet_address, COUNT(id) as votes, COUNT(id) as points
            FROM votes
            GROUP BY wallet_address
            ORDER BY points DESC
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/dashboard/:walletAddress', async (req, res) => {
    const { walletAddress } = req.params;
    try {
        const historyResult = await db.query(
            'SELECT cip_number, vote_choice, timestamp FROM votes WHERE wallet_address = $1 ORDER BY timestamp DESC',
            [walletAddress]
        );
        const statsResult = await db.query(
            'SELECT COUNT(id) as "totalVotes", COUNT(id) as "governancePoints" FROM votes WHERE wallet_address = $1',
            [walletAddress]
        );
        const leaderboardResult = await db.query(`
            SELECT wallet_address, COUNT(id) as points FROM votes GROUP BY wallet_address ORDER BY points DESC
        `);

        const votingHistory = historyResult.rows;
        const stats = statsResult.rows[0];
        const leaderboard = leaderboardResult.rows;
        const rank = leaderboard.findIndex(v => v.wallet_address === walletAddress) + 1;

        res.json({ ...stats, leaderboardRank: rank > 0 ? rank : 'N/A', votingHistory });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/votes/:walletAddress', async (req, res) => {
    const { walletAddress } = req.params;
    try {
        const result = await db.query('SELECT cip_number, vote_choice FROM votes WHERE wallet_address = $1', [walletAddress]);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/credits/:walletAddress', async (req, res) => {
    const { walletAddress } = req.params;
    const DEFAULT_FREE_CREDITS = 500;

    let userResult = await db.query('SELECT * FROM users WHERE wallet_address = $1', [walletAddress]);
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
        const cachedResult = await db.query(
            'SELECT * FROM translations_cache WHERE original_text_hash = $1 AND target_language = $2',
            [originalTextHash, targetLanguage]
        );
        if (cachedResult.rows[0]) {
            return res.json({ translatedText: cachedResult.rows[0].translated_text });
        }

        const systemPrompt = "You are a professional, multilingual translator...";
        const userPrompt = `Translate the following text into ${targetLanguage}:\n\n---\n\n${textToTranslate}`;
        const chatCompletion = await gaiaNode.chat.completions.create({ model: process.env.GAIA_MODEL_NAME, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }] });
        const translatedText = chatCompletion.choices[0].message.content;

        await db.query(
            'INSERT INTO translations_cache (original_text_hash, target_language, translated_text) VALUES ($1, $2, $3)',
            [originalTextHash, targetLanguage, translatedText]
        );

        res.json({ translatedText });
    } catch (error) {
        res.status(500).json({ error: 'Failed to translate summary.' });
    }
});

app.listen(port, () => {
    console.log(`Backend server running at http://localhost:${port}`);
    console.log(`Using environment: ${process.env.NODE_ENV || 'local'}`);
});