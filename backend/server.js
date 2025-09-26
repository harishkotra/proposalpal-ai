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
  const dbFilename = process.env.DATABASE_FILENAME || './database.db';
  db = await setupDatabase(dbFilename);
})();

// API Endpoints

app.post('/api/summarize-cip', async (req, res) => {
    const { walletAddress, cipNumber } = req.body;

    if (!walletAddress || !cipNumber) {
        return res.status(400).json({ error: 'CIP number and wallet address are required.' });
    }

    try {

        const cachedSummary = await db.get('SELECT * FROM summaries_cache WHERE cip_number = ?', [cipNumber]);

        if (cachedSummary) {
            console.log(`[CACHE HIT] Serving summary for ${cipNumber} from cache.`);
            // Log this activity for the user's record (but it's free)
            await db.run(
                'INSERT INTO activity_log (wallet_address, cip_number, was_cached) VALUES (?, ?, ?)',
                [walletAddress, cipNumber, true] // true means it was cached
            );
            // Return the cached summary and exit
            return res.json({ title: cachedSummary.title, summary: cachedSummary.summary });
        }

        console.log(`[CACHE MISS] Generating new summary for ${cipNumber}.`);

        // Check user credits (only happens on a cache miss)
        let user = await db.get('SELECT * FROM users WHERE wallet_address = ?', [walletAddress]);
        if (!user) {
            await db.run('INSERT INTO users (wallet_address) VALUES (?)', [walletAddress]);
            user = { credits_remaining: 500 };
        }
        if (user.credits_remaining <= 0) {
            return res.status(402).json({ error: 'Payment required.' });
        }

        // Fetch from GitHub
        const cipContentUrl = `https://raw.githubusercontent.com/cardano-foundation/CIPs/refs/heads/master/${cipNumber}/README.md`;
        const response = await axios.get(cipContentUrl);
        const cipContent = response.data;

        // 2. Define the simple, direct prompts
        const systemPrompt = "You are an expert Cardano analyst. Your task is to summarize the provided text from a Cardano Improvement Proposal (CIP) in simple, easy-to-understand language for a general audience. Your summary should be around 200 words and focus on the problem the CIP solves and its proposed solution.";
        const userPrompt = `Please summarize the following content from ${cipNumber}:\n\n---\n\n${cipContent}`;

        // 3. Make the single API call to the Gaia Node
        const chatCompletion = await gaiaNode.chat.completions.create({
            model: process.env.GAIA_MODEL_NAME,
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        });

        const finalSummary = chatCompletion.choices[0].message.content;
        const finalTitle = `Summary for ${cipNumber}`;

        await db.run(
            'INSERT INTO summaries_cache (cip_number, title, summary) VALUES (?, ?, ?)',
            [cipNumber, finalTitle, finalSummary]
        );
        console.log(`[CACHE WRITE] Saved new summary for ${cipNumber} to cache.`);

        // 4. Decrement the user's credits
        await db.run('UPDATE users SET credits_remaining = credits_remaining - 1 WHERE wallet_address = ?', [walletAddress]);
        
        await db.run(
            'INSERT INTO activity_log (wallet_address, cip_number, was_cached) VALUES (?, ?, ?)',
            [walletAddress, cipNumber, false] // false means a credit was spent
        );

        // Send the newly generated response
        res.json({ title: finalTitle, summary: finalSummary });

    } catch (error) {
        if (error.isAxiosError && error.response && error.response.status === 404) {
            return res.status(404).json({ error: `Could not find content for ${cipNumber}. Please check the number and format.` });
        }
        console.error("Error during summarization:", error);
        res.status(500).json({ error: 'Failed to generate summary. The AI node may be experiencing issues.' });
    }
});

// app.post('/api/confirm-payment', async (req, res) => {
//     const { walletAddress, txHash } = req.body;
//     const creditsToAdd = 1500;
//     // !! IMPORTANT !!
//     // In a real production app, you would use a service like Blockfrost or Koios here
//     // to verify the txHash on-chain to ensure the payment was real.
//     // For this project, we will trust the client's confirmation for simplicity.
//     console.log(`Received payment confirmation for ${walletAddress} with txHash ${txHash}`);
    
//     await db.run(
//       'UPDATE users SET credits_remaining = credits_remaining + ?, credits_purchased = credits_purchased + ? WHERE wallet_address = ?', 
//       [creditsToAdd, creditsToAdd, walletAddress]
//     );
    
//     res.json({ success: true, message: `${creditsToAdd} credits added.` });
// });

// 1. Get CIP data (Mocked Gaia Node)
// app.get('/api/cip/:cipNumber', (req, res) => {
//   const { cipNumber } = req.params;
//   const data = cipData[cipNumber];

//   if (data) {
//     res.json(data);
//   } else {
//     res.status(404).json({ error: 'CIP not found' });
//   }
// });

// 2. Submit a vote
app.post('/api/vote', async (req, res) => {
  const { walletAddress, cipNumber, voteChoice } = req.body;
  if (!walletAddress || !cipNumber || !voteChoice) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await db.run(
      'INSERT INTO votes (wallet_address, cip_number, vote_choice) VALUES (?, ?, ?)',
      [walletAddress, cipNumber, voteChoice]
    );
    res.status(201).json({ success: true, id: result.lastID });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'User has already voted on this CIP' });
    }
    res.status(500).json({ error: 'Database error', details: error.message });
  }
});

app.post('/api/confirm-payment', async (req, res) => {
    const { walletAddress, txHash } = req.body;
    if (!txHash) {
        return res.status(400).json({ error: 'Transaction hash is required.' });
    }

    try {
        // 1. Prevent Replay Attacks: Check if txHash has already been claimed
        const existingTx = await db.get('SELECT tx_hash FROM claimed_transactions WHERE tx_hash = ?', [txHash]);
        if (existingTx) {
            return res.status(409).json({ error: 'This transaction has already been used to claim credits.' });
        }

        // 2. Fetch Transaction Details from Blockfrost
        // We use txsUtxos as it clearly shows all outputs.
        const txInfo = await blockfrost.txsUtxos(txHash);

        const paymentAddress = process.env.PAYMENT_WALLET_ADDRESS;
        const requiredAmount = process.env.VITE_PAYMENT_AMOUNT; // In Lovelace
        
        // 3. Verify the Payment
        let paymentVerified = false;
        // Iterate through all outputs of the transaction
        for (const output of txInfo.outputs) {
            // Check if an output was sent to our treasury address
            if (output.address === paymentAddress) {
                // Find the lovelace amount in that output
                const lovelaceAmount = output.amount.find(amt => amt.unit === 'lovelace');
                // Check if the amount is sufficient
                if (lovelaceAmount && BigInt(lovelaceAmount.quantity) >= BigInt(requiredAmount)) {
                    paymentVerified = true;
                    break; // Found a valid payment, no need to check other outputs
                }
            }
        }

        // 4. Grant Credits if Verified
        if (paymentVerified) {
            const creditsToAdd = 1500;
            // First, record the transaction hash so it cannot be used again
            await db.run('INSERT INTO claimed_transactions (tx_hash) VALUES (?)', [txHash]);

            // Then, add the credits to the user's account
            await db.run(
                'UPDATE users SET credits_remaining = credits_remaining + ?, credits_purchased = credits_purchased + ? WHERE wallet_address = ?',
                [creditsToAdd, creditsToAdd, walletAddress]
            );
            
            console.log(`SUCCESS: Credits granted for txHash ${txHash}`);
            return res.json({ success: true, message: `${creditsToAdd} credits added successfully.` });
        } else {
            // If the loop completes and no valid payment was found
            return res.status(400).json({ error: 'Payment not found in transaction. Please verify the amount and recipient address.' });
        }

    } catch (error) {
        // Handle errors from Blockfrost (e.g., tx not found)
        if (error.status === 404) {
            return res.status(404).json({ error: 'Transaction not found. Please wait a moment for it to appear on the blockchain and try again.' });
        }
        console.error('Blockfrost API Error:', error);
        return res.status(500).json({ error: 'Failed to verify transaction with the blockchain provider.' });
    }
});

// Get leaderboard data
app.get('/api/leaderboard', async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT wallet_address, COUNT(id) as votes, COUNT(id) as points
      FROM votes
      GROUP BY wallet_address
      ORDER BY points DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error', details: error.message });
  }
});

// Get dashboard data for a specific user
app.get('/api/dashboard/:walletAddress', async (req, res) => {
  const { walletAddress } = req.params;
  try {
    // Get voting history
    const votingHistory = await db.all(
      'SELECT cip_number, vote_choice, timestamp FROM votes WHERE wallet_address = ? ORDER BY timestamp DESC',
      [walletAddress]
    );

    // Get total votes/points
    const stats = await db.get(
      'SELECT COUNT(id) as totalVotes, COUNT(id) as governancePoints FROM votes WHERE wallet_address = ?',
      [walletAddress]
    );

    // Get rank
    const leaderboard = await db.all(`
      SELECT wallet_address, COUNT(id) as points
      FROM votes
      GROUP BY wallet_address
      ORDER BY points DESC
    `);
    const rank = leaderboard.findIndex(v => v.wallet_address === walletAddress) + 1;

    res.json({
      ...stats,
      leaderboardRank: rank > 0 ? rank : 'N/A',
      votingHistory,
    });
  } catch (error) {
    res.status(500).json({ error: 'Database error', details: error.message });
  }
});

// Get all votes for a user (to check for double voting on the client)
app.get('/api/votes/:walletAddress', async (req, res) => {
    const { walletAddress } = req.params;
    try {
        const votes = await db.all('SELECT cip_number, vote_choice FROM votes WHERE wallet_address = ?', [walletAddress]);
        res.json(votes);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/credits/:walletAddress', async (req, res) => {
    const { walletAddress } = req.params;

    // This value should be consistent with your database default.
    const DEFAULT_FREE_CREDITS = 500;

    let user = await db.get('SELECT * FROM users WHERE wallet_address = ?', [walletAddress]);
    
    // If user doesn't exist, create them with the correct defaults
    if (!user) {
        await db.run('INSERT INTO users (wallet_address, credits_remaining, credits_purchased) VALUES (?, ?, ?)', [walletAddress, DEFAULT_FREE_CREDITS, 0]);
        // Set the user object to reflect the newly created state
        user = { credits_remaining: DEFAULT_FREE_CREDITS, credits_purchased: 0 };
    }

    const totalCredits = DEFAULT_FREE_CREDITS + user.credits_purchased;
    
    // 2. Consumed credits is the difference between the total and what remains.
    const consumedCredits = totalCredits - user.credits_remaining;

    res.json({
        remaining: user.credits_remaining,
        consumed: consumedCredits,
        total: totalCredits
    });
});

app.post('/api/translate', async (req, res) => {
    const { textToTranslate, targetLanguage } = req.body;

    if (!textToTranslate || !targetLanguage) {
        return res.status(400).json({ error: 'Text and target language are required.' });
    }

    // 1. Create a stable hash of the original text to use as a cache key.
    const originalTextHash = crypto.createHash('sha256').update(textToTranslate).digest('hex');

    try {
        // 2. Check if this exact translation is already in our cache.
        const cachedTranslation = await db.get(
            'SELECT * FROM translations_cache WHERE original_text_hash = ? AND target_language = ?',
            [originalTextHash, targetLanguage]
        );

        // 3. CACHE HIT: If found, return the cached data instantly.
        if (cachedTranslation) {
            console.log(`[CACHE HIT] Serving translation to ${targetLanguage} from cache.`);
            return res.json({ translatedText: cachedTranslation.translated_text });
        }

        // 4. CACHE MISS: Proceed with the AI call.
        console.log(`[CACHE MISS] Generating new translation to ${targetLanguage}.`);
        
        const systemPrompt = "You are a professional, multilingual translator. Your task is to translate the given text accurately into the specified target language. Preserve the original markdown formatting (like bold text using **). Do not add any extra commentary, greetings, or explanations before or after the translation.";
        const userPrompt = `Translate the following text into ${targetLanguage}:\n\n---\n\n${textToTranslate}`;

        const chatCompletion = await gaiaNode.chat.completions.create({
            model: process.env.GAIA_MODEL_NAME,
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        });

        const translatedText = chatCompletion.choices[0].message.content;

        // 5. Save the new translation to the cache for future requests.
        await db.run(
            'INSERT INTO translations_cache (original_text_hash, target_language, translated_text) VALUES (?, ?, ?)',
            [originalTextHash, targetLanguage, translatedText]
        );
        console.log(`[CACHE WRITE] Saved new translation to ${targetLanguage} to cache.`);

        res.json({ translatedText });

    } catch (error) {
        console.error("Error during translation:", error);
        res.status(500).json({ error: 'Failed to translate summary. The AI node may be experiencing issues.' });
    }
});

app.listen(port, () => {
  console.log(`Backend server running at http://localhost:${port}`);
  console.log(`Using environment: ${process.env.NODE_ENV || 'local'}`);
});